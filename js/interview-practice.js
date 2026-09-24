(function () {
  var config = window.INTERVIEW_PRACTICE || {};
  var endpoint = config.endpoint;
  var root = document.querySelector(".page__content");
  if (!root || !endpoint) return;

  var QUESTION = /^(?:Q\s*)?\d+\.\s*/;
  var active = null;

  function isQuestionHeading(node) {
    if (!node || node.nodeType !== 1) return false;
    var tag = node.tagName;
    if (tag !== "H3" && tag !== "H4") return false;
    return QUESTION.test((node.textContent || "").trim());
  }

  function answerNodes(heading) {
    var nodes = [];
    var el = heading.nextElementSibling;
    while (el && !isQuestionHeading(el)) {
      nodes.push(el);
      el = el.nextElementSibling;
    }
    return nodes;
  }

  function setBlur(nodes, on) {
    nodes.forEach(function (node) {
      node.classList.toggle("interview-answer-blur", on);
      if (on) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
    });
  }

  function panel() {
    var existing = document.querySelector(".interview-panel");
    if (existing) return existing;

    var el = document.createElement("section");
    el.className = "interview-panel";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.setAttribute("aria-labelledby", "interview-panel-title");
    el.innerHTML =
      '<header class="interview-panel__header">' +
      '<div><p class="interview-panel__kicker">모의 면접</p>' +
      '<h2 id="interview-panel-title" class="interview-panel__title"></h2></div>' +
      '<button type="button" class="interview-panel__close" aria-label="연습 닫기">닫기</button>' +
      "</header>" +
      '<p class="interview-panel__note">연습 중에는 이 문항의 답안이 가려집니다. 힌트는 방향만 받습니다.</p>' +
      '<div class="interview-panel__log" aria-live="polite"></div>' +
      '<form class="interview-panel__form">' +
      '<label class="interview-panel__label" for="interview-panel-input">내 답변</label>' +
      '<textarea id="interview-panel-input" rows="3" maxlength="4000" placeholder="아는 만큼 짧게 답해 보세요."></textarea>' +
      '<div class="interview-panel__actions">' +
      '<button type="button" class="interview-panel__hint" data-hint>힌트</button>' +
      '<button type="submit" class="interview-panel__send">답변 보내기</button>' +
      "</div></form>";
    document.body.appendChild(el);
    el.querySelector(".interview-panel__close").addEventListener("click", closePractice);
    el.querySelector("form").addEventListener("submit", onSubmit);
    el.querySelector("[data-hint]").addEventListener("click", function () {
      send("힌트를 주세요. 정답은 말하지 말고 방향만 알려 주세요.");
    });
    el.querySelector("textarea").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        el.querySelector("form").requestSubmit();
      }
    });
    return el;
  }

  function closePractice() {
    if (!active) return;
    setBlur(active.answers, false);
    active.button.classList.remove("is-active");
    active.button.textContent = "연습하기";
    active = null;
    var el = document.querySelector(".interview-panel");
    if (el) el.hidden = true;
  }

  function openPractice(heading, button) {
    if (active && active.heading === heading) {
      closePractice();
      return;
    }
    closePractice();
    var answers = answerNodes(heading);
    setBlur(answers, true);
    button.classList.add("is-active");
    button.textContent = "연습 중";
    var question = heading.querySelector(".interview-q__text").textContent.trim();
    active = { heading: heading, button: button, answers: answers, question: question, messages: [], pending: false };

    var el = panel();
    el.hidden = false;
    el.querySelector(".interview-panel__title").textContent = question;
    var log = el.querySelector(".interview-panel__log");
    log.innerHTML = "";
    appendBubble("interviewer", question);
    el.querySelector("textarea").value = "";
    el.querySelector("textarea").focus();
  }

  function appendBubble(role, text) {
    var log = document.querySelector(".interview-panel__log");
    var bubble = document.createElement("div");
    bubble.className = "interview-bubble interview-bubble--" + role;
    var who = document.createElement("span");
    who.className = "interview-bubble__who";
    who.textContent = role === "interviewer" ? "면접관" : "나";
    var body = document.createElement("p");
    body.textContent = text;
    bubble.append(who, body);
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function setPending(on) {
    if (!active) return;
    active.pending = on;
    var el = document.querySelector(".interview-panel");
    el.querySelector(".interview-panel__send").disabled = on;
    el.querySelector("[data-hint]").disabled = on;
    el.querySelector("textarea").disabled = on;
  }

  function errorText(status, code) {
    if (status === 429 || code === "rate_limited") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    if (status === 400 || code === "invalid_input") return "요청 형식이 올바르지 않습니다.";
    return "면접관을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  async function readSse(response, onDelta) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var reply = "";
    var failed = false;

    function take(block) {
      var data = block
        .split("\n")
        .filter(function (line) { return line.startsWith("data:"); })
        .map(function (line) { return line.slice(5).trim(); })
        .join("\n");
      if (!data) return;
      var payload = JSON.parse(data);
      if (payload.error) {
        failed = true;
        return;
      }
      if (typeof payload.delta === "string") {
        reply += payload.delta;
        onDelta(reply);
      }
      if (typeof payload.reply === "string") reply = payload.reply;
    }

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      var parts = buffer.split("\n\n");
      buffer = parts.pop();
      parts.forEach(take);
    }
    if (buffer.trim()) take(buffer);
    if (failed || !reply.trim()) throw new Error("upstream_failed");
    return reply;
  }

  async function send(text) {
    if (!active || active.pending) return;
    var content = text.trim();
    if (!content) return;
    var el = document.querySelector(".interview-panel");
    el.querySelector("textarea").value = "";
    appendBubble("user", content);
    active.messages.push({ role: "user", content: content });
    setPending(true);
    var body = appendBubble("interviewer", "생각하고 있습니다…");

    try {
      var response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: active.question, messages: active.messages }),
      });
      if (!response.ok) {
        var code = "";
        try {
          code = (await response.json()).error || "";
        } catch (ignore) {
          code = "";
        }
        throw new Error(errorText(response.status, code));
      }
      var reply = await readSse(response, function (partial) {
        body.textContent = partial;
        body.parentElement.parentElement.scrollTop = body.parentElement.parentElement.scrollHeight;
      });
      body.textContent = reply;
      active.messages.push({ role: "assistant", content: reply });
    } catch (error) {
      active.messages.pop();
      body.textContent = error.message && error.message !== "upstream_failed"
        ? error.message
        : "면접 서버에 연결하지 못했습니다.";
      body.parentElement.classList.add("interview-bubble--error");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    var input = document.querySelector("#interview-panel-input");
    send(input.value);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closePractice();
  });

  Array.prototype.forEach.call(root.querySelectorAll("h3, h4"), function (heading) {
    if (!isQuestionHeading(heading)) return;
    var text = heading.textContent.trim();
    heading.textContent = "";
    heading.classList.add("interview-q");
    var label = document.createElement("span");
    label.className = "interview-q__text";
    label.textContent = text;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "interview-practice-btn";
    button.textContent = "연습하기";
    button.addEventListener("click", function () { openPractice(heading, button); });
    heading.append(label, button);
  });
})();
