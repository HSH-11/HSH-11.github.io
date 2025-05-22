---
layout: post
title: "Checked,Unchecked Exception"
tag: [Java, Interview]
description: Checked Exception과 Unchecked Exception에 대해서 설명해주세요.
image: '/images/2025-03-19-Exception/Checked-and-Unchecked-exceptions-in-jaa.jpg'
tags_color: '#4643ec'
---

## Checked Exception과 Unchecked Exception에 대해서 설명해주세요.

Checked Exception은 **컴파일 시점에 확인**되며, **반드시 처리해야 하는 예외**입니다. 

자바에서는 `IOException`, `SQLException` 등이 이에 속합니다. 

Checked Exception을 유발하는 메서드를 호출하는 경우, 메서드 시그니처에 `throws`를 사용하여 호출자에게 예외를 위임하거나 메서드 내에서 try-catch를 사용하여 해당 예외를 반드시 처리해야 합니다.

Unchecked Exception은 **런타임 시점에 발생**하는 예외로, 컴파일러가 처리 여부를 강제하지 않습니다. 자바에서는 `RuntimeException`을 상속한 예외들이 해당됩니다. 일반적으로 프로그래머의 실수나 코드 오류로 인해 발생합니다.

## 각각 언제 사용해야 할까요? 🤔

✔️ **Checked Exception**

**외부 환경과의 상호작용**에서 발생 가능성이 높은 예외에 적합.

- 파일 입출력 (`IOException`)
- 네트워크 통신 (`MalformedURLException`, `SocketException`)
- 데이터베이스 연결 (`SQLException`)
- 클래스 로딩 (`ClassNotFoundException`)
- 외부 API 호출 시 (API가 Checked Exception을 던지는 경우)

컴파일러가 예외 처리를 강제하여 **안정성을 보장**할 수 있음.

✔️ **Unchecked Exception**

**프로그래머의 실수나 논리적 오류**로 인해 발생하는 예외에 적합.

- `NullPointerException` (null 참조)
- `ArrayIndexOutOfBoundsException` (잘못된 인덱스 접근)
- `ArithmeticException` (0으로 나누기)
- `IllegalArgumentException` (잘못된 파라미터 전달)
- `IllegalStateException` (잘못된 객체 상태에서 메서드 호출)

<br>

## Error와 Exception의 차이는 무엇인가요? 🤓

Error는 주로 JVM에서 발생하는 심각한 문제로, `OutOfMemoryError`, `StackOverflowError` 등 시스템 레벨에서 발생하는 오류입니다. 이는 일반적으로 프로그램에서 처리하지 않으며, **회복이 어려운 오류**에 속하며, 애플리케이션 코드에서 복구할 수 없는 심각한 문제를 나타냅니다. 따라서 예외 처리를 하지 않으며, 보통 프로그램을 종료해야 합니다.

반면, Exception은 프로그램 실행 중 발생할 수 있는 오류 상황을 나타냅니다. 대부분의 경우 **회복 가능성**이 있으며, 프로그램 내에서 예외 처리를 통해 오류 상황을 제어할 수 있습니다. Exception은 다시 `Checked Exception`과 `Unchecked Exception`으로 나눌 수 있습니다.
