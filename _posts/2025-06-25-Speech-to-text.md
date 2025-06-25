---
layout: post
title: Speech-to-Text
description: ETRI STT API 사용
image: '/images/2025-06-25-Speech-to-text/음성인식.png'
tags: [Dev]
tags_color: '#87CEFA'
---

### ETRI STT API 소개

최신 인공지능 기술에 기반하여 한국어, 영어, 다국어(일본어/중국어/독어/불어/스페인어/러시아어/베트남어/아랍어/태국어)에 대해 고성능의 음성인식 정확률을 제공하는 서비스로서, 사용자가 발성한 녹음된 입력 음성 데이터(단위 파일 또는 버퍼)를 음성인식 서버로 전달하여 문자(텍스트)로 제공합니다. 

음성인식 API는 HTTP 기반의 REST API 인터페이스로 JSON 포맷 기반의 입력 및 출력을 지원하며 ETRI에서 제공하는 API Key 인증을 통해 사용할 수 있는 Open API 입니다.

### 음성인식 API 사용

음성인식 API는 REST API이며, 음성인식에 사용하기 위해 샘플링 주파수16kHz로 녹음된 음성 파일을 Base64로 Encoding 하여 HTTP 통신으로 ETRI Open API 서버에 전달하면 됩니다. 

서버가 제공하는 REST API의 URI는 다음과 같으며 POST 방식으로 호출해야 합니다.

```
http://aiopen.etri.re.kr:8000/WiseASR/Recognition
```

#### API 발급 및 확인

상단 API Key에서 이메일 입력 후 해당 이메일에서 API Key를 확인합니다.

![image-20250625104659986](../images/2025-06-25-Speech-to-text/image-20250625104659986.png)

HTTP 요청으로 음성인식을 요청할 때 사전 준비 사항에서 발급받은 API Key 정보를 요청 본문에 포함시켜야 합니다.

다음은 HTTP 요청 메시지 예시입니다.

```
[HTTP Request Header]
"Authorization" : "YOUR_ACCESS_KEY"

[HTTP Request Body]
{
    "request_id": "reserved field",
    "argument": {
        "language_code": "LANGUAGE_CODE",
        "audio": "BASE64_OF_AUDIO_DATA"
    }
}
```

위와 같은 HTTP 요청을 ETRI Open API 서버로 전달하면 서버는 JSON 형태의 Text 데이터를 HTTP 응답 메시지로 반환합니다. 다음은 HTTP 응답 예제입니다.

```
[HTTP Response Header]
Access-Control-Allow-Origin:*
Connection:close
Content-Length:0
Content-Type:application/json; charset=UTF-8

[HTTP Response Body]
{
    "request_id": "reserved field",
    "result": 0,
    "return_object": {음성인식 결과 JSON}
}
```

### 실제 프로젝트 적용 코드

#### 브라우저에서 마이크로 녹음한 음성을 WAV로 변환해 서버에 전송하는 코드

웹에서 마이크로 녹음한 음성을 실시간으로 받아 WAV 포맷으로 변환한 뒤, 서버에 전송하고 음성 인식을 수행하는 전체 흐름을 구현한 코드입니다.

MediaRecoder API, Web Audio API, fetch API 등을 조합하여 구성하였습니다.

```javascript
const startRecording = async () => {
    try {
      // 마이크 접근 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
      // MediaRecorder를 사용하여 녹음 시작
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      bufferRef.current = [];
		
      // 오디오 데이터가 수집될 때마다 audioChunks 배열에 저장
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
	  
      // 녹음 종료 시 처리할 로직
      mediaRecorder.onstop = async () => {
        // WebM 형식의 blob으로 변환
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Blob을 ArrayBuffer로 변환 (Web Audio API 처리용)
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContext();
          
        // 오디오 데이터를 디코딩하여 AudioBuffer 객체 생성
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
		
        // 다운샘플링 : sample rate를 16kHz로 변환 (STT 엔진 요구)
        const downsampled = downsampleBuffer(audioBuffer, 16000);
          
        // 16bit PCM WAV 형식으로 인코딩
        const wavBlob = encodeWAV(downsampled, 16000);
		
        // 서버 전송용 FormData 구성
        const formData = new FormData();
        formData.append('file', new Blob([wavBlob], { type: 'audio/wav' }), 'voice.wav');
		
        // 인증 토큰 가져오기
        const token = getAuthToken();
		
        // Spring 서버로 WAV 파일 전송
        // Spring 서버에서 Base64로 처리 후 STT API에 전송
        const res = await fetch('http://localhost:8080/api/stt', {
          method: 'POST',
          headers: {
            'X-AUTH-TOKEN': token,
          },
          body: formData,
        });
		
        // 응답 결과에서 transcript 텍스트 추출
        const resultText = await res.text();
        try {
          const parsed = JSON.parse(resultText);
          const transcript = parsed.transcript?.trim();
          if (transcript) {
            setInput(transcript);
          }
        } catch (e) {
          console.error("STT 응답 파싱 실패:", e);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('🎙️ 음성 녹음 오류:', err);
    }
  };
```

#### 전체  흐름 요약

1. 브라우저에서 마이크 권한을 요청하고
2. 녹음을 시작하여 음성 데이터를 수집
3. 녹음이 끝나면 WebM -> PCM -> WAV 변환
4. WAV 파일을 서버로 전송하여 STT 결과(문자)를 받아오기

------

#### Web Audio API를 활용한 오디오 다운 샘플링 및 WAV 변환 유틸리티 코드

음성 녹음 데이터를 서버에 전송하려면, ETRI STT API가 요구하는 형태로 반환해야 합니다.

따라서 **샘플링 주파수를 낮추고(WAV 16kHz)**, **16bit PCM 포맷의 WAV 파일**로 변환하는 코드를 작성했습니다.

- **downsampleBuffer** : 샘플레이트를 낮춰주는 함수

```javascript
export const downsampleBuffer = (audioBuffer, targetSampleRate) => {
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0)
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);

    let offset = 0;
    for (let i = 0; i < newLength; i++) {
        result[i] = samples[Math.floor(offset)];
        offset += ratio;
    }

    return result;
};
```

1. audioBuffer: Web Audio API에서 디코딩한 고해상도 오디오 (보통 44.1kHz 이상)
2. targetSampleate: 변환할 목표 샘플레이트
3. 샘플 수를 줄여 데이터 크기를 줄이고, STT 서버 포맷에 맞춤

<br>

- **encodeWAV** : Float32Array를 WAV Blob으로 변환하는 함수

```javascript
export const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2); // WAV 헤더(44바이트) + 데이터
    const view = new DataView(buffer);

    // 문자열을 view에 씀 (RIFF, WAVE 등)
    const writeString = (view, offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // float (-1~1) 값을 16bit PCM 정수로 변환
    const floatTo16BitPCM = (output, offset, input) => {
        for (let i = 0; i < input.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, input[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            output.setInt16(offset, s, true); // 리틀 엔디언
        }
    };

    // WAV 포맷에 맞게 헤더 작성
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true); // 파일 크기
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // Audio format (PCM)
    view.setUint16(22, 1, true);  // 채널 수: 1 (mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate = SampleRate * NumChannels * BytesPerSample
    view.setUint16(32, 2, true);  // BlockAlign = NumChannels * BytesPerSample
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true); // Data chunk size

    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
};

```

------

### Spring 서버 코드

#### SttController

```java
@RestController
@RequiredArgsConstructor
public class SttController {

    private final SttService sttService;

    @PostMapping("/api/stt")
    public ResponseEntity<Map<String, String>> handleAudioUpload(@RequestParam("file") MultipartFile file) {
        String transcript = sttService.transcribeWav(file); // 내부적으로 저장 → Base64 → ETRI 호출
        return ResponseEntity.ok(Map.of("transcript", transcript));
    }
}
```

### SttServiceImpl

```java
@Service
@RequiredArgsConstructor
public class SttServiceImpl implements SttService {

    private final String openApiURL = "http://aiopen.etri.re.kr:8000/WiseASR/Recognition";
    private final String accessKey = "발급받은 API 키";
    private final Gson gson = new Gson();

    @Override
    public String transcribeWav(MultipartFile file) {
        try {
            // 1. Base64로 인코딩
            byte[] audioBytes = file.getBytes();
            String audioContents = Base64.getEncoder().encodeToString(audioBytes);

            // 2. JSON 요청 구성
            Map<String, Object> request = new HashMap<>();
            Map<String, String> argument = new HashMap<>();
            argument.put("language_code", "korean");
            argument.put("audio", audioContents);
            request.put("argument", argument);

            // 3. HTTP 요청
            URL url = new URL(openApiURL);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            con.setRequestProperty("Authorization", accessKey);

            DataOutputStream wr = new DataOutputStream(con.getOutputStream());
            wr.write(gson.toJson(request).getBytes("UTF-8"));
            wr.flush();
            wr.close();

            // 4. 응답 읽기
            InputStream is = con.getInputStream();
            String response = new String(is.readAllBytes());

            // 5. 응답에서 텍스트 추출
            Map<?, ?> responseMap = gson.fromJson(response, Map.class);
            Map<?, ?> returnObj = (Map<?, ?>) responseMap.get("return_object");
            String recognized = returnObj != null ? (String) returnObj.get("recognized") : null;

            return recognized != null ? recognized : "[인식 실패]";
        } catch (Exception e) {
            e.printStackTrace();
            return "[에러 발생: " + e.getMessage() + "]";
        }
    }
}
```

1. 클라이언트에서 WAV 파일을 업로드 (multipart/form-data)

2. 파일 -> Base64로 변환
3. ETRI API로 JSON POST 요청
4. 응답에서 텍스트 추출 후 반환

#### build.gradle

```
dependencies {
	implementation 'com.google.code.gson:gson:2.13.1'
}
```

