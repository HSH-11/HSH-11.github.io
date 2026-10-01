(function () {
  function openDialog(dialog) {
    if (!dialog || typeof dialog.showModal !== "function" || dialog.open) {
      return;
    }
    document.querySelectorAll(".case-dialog[open]").forEach(function (openDialog) {
      openDialog.close();
    });
    dialog.showModal();
    document.body.classList.add("portfolio-dialog-open");
    var closeButton = dialog.querySelector("[data-close-dialog]");
    if (closeButton) {
      closeButton.focus();
    }
  }

  document.querySelectorAll("[data-open-dialog]").forEach(function (opener) {
    opener.addEventListener("click", function () {
      openDialog(document.getElementById(opener.getAttribute("data-open-dialog")));
    });
  });

  document.querySelectorAll(".case-dialog").forEach(function (dialog) {
    dialog.querySelectorAll("[data-close-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        dialog.close();
      });
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.addEventListener("close", function () {
      if (!document.querySelector(".case-dialog[open]")) {
        document.body.classList.remove("portfolio-dialog-open");
      }
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    document.querySelectorAll(".case-dialog[open]").forEach(function (dialog) {
      dialog.close();
    });
  });
})();
