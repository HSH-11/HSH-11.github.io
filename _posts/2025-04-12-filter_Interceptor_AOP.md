---
layout: single
title:  "Filter,Interceptor,AOP"
categories: Spring
tag: [Spring, BackEnd]
toc: true
toc_sticky: true
toc_label: 목차
author_profile: false
---


# Filter와Interceptor의 개념 및 차이

공통 업무에 관련된 코드를 서비스마다 작성한다면 증복 코드가 많아지게 되고, 프로젝트 단위가 커질수록 서버에 부하를 줄 수도 있으며, 소스 관리도 되지 않는다.

이에 Spring은 공통적으로 여러 작업을 처리함으로써 중복된 코드를 제거할 수 다음과 같은 기능들을 지원하고 있다.

## Filter

### Filter란?

필터는 서블릿 규격에 따라 작동하며 Spring과는 독립적으로 동작한다. 주로 인증,권한 처리, 보안 관련 작업에 사용된다. 

예를 들어, 스프링 시큐리티에서는 필터를 사용하여 사용자의 인증 상태를 확인하고, 적절한 권한이 있는 지 검증한다. 또한, CORS 설정이나 XSS 방어와 같은 작업에도 필터가 사용된다.

필터는 클라이언트 요청이 Dispatcher Servlet에 **요청이 도달하기 전/후에 url 패턴에 맞는 모든 요청에 대해 부가 작업을 처리할 수 있는 기능을 제공**한다.

![filter]({{site.url}}/images/2025-04-12-filter_Interceptor_AOP/filter.png)

즉, **스프링 컨테이너가 아닌 Tomcat과 같은 웹 컨테이너에 의해 관리**가 되는 것이고, 스프링 범위 밖에서 처리되는 것이다.

필터를 설정하려면, 서블릿 컨테이너의 web.xml이나 스프링 부트의 @Bean 어노테이션을 사용하여 등록할 수 있다.

### Filter의 Method

Filter를 사용하기 위해서는 javax.servlet의 Filter 인터페이스를 구현해야 하며, 다음과 같은 메소드를 가진다.

```java
public interface Filter {
 
    public default void init(FilterConfig filterConfig) throws ServletException {}
 
    public void doFilter(ServletRequest request, ServletResponse response,
            FilterChain chain) throws IOException, ServletException;
 
    public default void destroy() {}
```

1. init()

   **필터 객체를 초기화하고 서비스에 추가하기 위한 메소드**이다.

   웹 컨테이너가 1회 init()을 호출하여 필터 객체를 초기화하면 이후 요청들은 doFilter()를 통해 처리된다.

2. doFilter()

   url-pattern에 맞는 모든 **HTTP 요청이 Dispatcher Servlet으로 전달되기 전에 웹 컨테이너에 의해 실행되는 메소드**이다.

   doFilter의 파라미터로 FilterChain이 있는데, FilterChain의 doFilter를 통해 다음 대상으로 요청을 전달할 수 있게 된다.

   chain.doFilter()로 전,후에 우리가 필요한 처리 과정을 넣어줌으로써 원하는 처리를 진행할 수 있다.

3. destroy()

   **필터 객체를 제거하고 사용하는 자원을 반환하기 위한 메소드**이다.

   웹 컨테이너가 1회 destroy()를 호출하여 필터 객체를 종료하면 이후에는 doFilter에 의해 처리되지 않는다.

## Interceptor

### Interceptor란?

스프링 MVC에서 제공하는 기능으로, 컨트롤러 전후의 흐름을 제어하는 데 주로 사용된다.

![Interceptor]({{site.url}}/images/2025-04-12-filter_Interceptor_AOP/Interceptor.png)

Dispatcher Servlet이 **Controller를 호출하기 전/후에 인터셉터가 끼어들어 요청과 응답을 참조하거나 가공할 수 있는 기능을 제공**한다.

웹 컨테이너에서 동작하는 Filter와는 달리 인터셉터는 **Spring Context에서 동작**한다.

![filter_interceptor]({{site.url}}/images/2025-04-12-filter_Interceptor_AOP/filter_interceptor.png)

디스패처 서블릿이 핸들러 매핑을 통해 컨트롤러를 찾도록 요청하는데, 그 결과로 HandlerExcutionChain을 돌려준다.

여기서 1개 이상의 인터셉터가 등록되어 있다면 순차적으로 인터셉터들을 거쳐 컨트롤러가 실행되도록 하고, 인터셉터가 없다면 바로 컨트롤러를 실행한다.

(실제로 Interceptor가 직접 Controller로 요청을 위임하는 것은 아니다.)

### Interceptor의 메소드 종류

인터셉터를 추가하기 위해서는 org.springframework.web.servlet의 HandlerInterceptor 인터페이스를 구현해야 하며, 다음과 같은 메소드를 가진다.

```java
public interface HandlerInterceptor { 	
    default boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)	throws Exception { 		
        return true;	
    } 	
    default void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler,@Nullable ModelAndView modelAndView) throws Exception{	
    } 	
    default void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,@Nullable Exception ex) throws Exception {
    }
```

![Filter_Interceptor_AOP]({{site.url}}/images/2025-04-12-filter_Interceptor_AOP/Filter_Interceptor_AOP.png)

preHandle()

- Controller가 호출되기 전에 실행된다.
- 컨트롤러 이전에 처리해야 하는 전처리 작업이나 요청 정보를 가공하거나 추가하는 경우에 사용할 수 있다. 

postHandle()

- Controller가 호출된 후에 실행된다. 
- (View 렌더링 전)컨트롤러 이후에 처리해야 하는 후처리 작업이 있을 때 사용할 수 있다. 이 메소드는 컨트롤러가 반환하는 ModelAndView 타입의 정보가 제공되는데, 최근에는 JSON 형태로 데이터를 제공하는 RestAPI 기반의 컨트롤러(@RestController)를 만들면서 자주 사용되지 않는다. 

afterCompletion()

- 모든 뷰에서 최종 결과를 생성하는 일을 포함해 모든 작업이 완료된 후에 실행된다. (View 렌더링 후)요청 처리 중에 사용한 리소스를 반환할 때 사용할 수 있다. 

### 인터셉터(Interceptor)와 AOP 비교

인터셉터 대신에 컨트롤러들에 적용할 부가기능을 어드바이스로 만들어 AOP를 적용할 수도 있다.하지만 다음과 같은 이유들로 컨트롤러의 호출 과정에 적용되는 부가기능들은 인터셉터를 사용하는 편이 낫다.

1. 컨트롤러는 타입과 실행 메소드가 모두 제각각이라 포인트컷의 작성이 어렵다.
2. 컨트롤러는 파라미터나 리턴 값이 일정하지 않다.

즉, 타입이 일정하지 않고 호출 패턴도 정해져 있지 않기 때문에 컨트롤러에 AOP를 적용하려면 번거로운 부가 작업들이 생기게 된다.

## 필터와 인터셉터의 차이 및 비교

### Request,Response 객체 조작 가능 여부

필터는 Request와 Response를 조작할 수 있지만, 인터셉터는 조작할 수 없다.

```java
public class MyFilter implements Filter {
 
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
    throws IOException, ServletException {
        // 다른 request와 response를 넣어줄 수 있음
        chain.doFilter(request, response);
    }
}
```

필터가 다음 필터를 호출하기 위해서는 필터 체이닝(다음 필터 호출)을 해주어야 한다. 
이때 request, response 객체를 넘겨주므로 우리가 원하는 request, response 객체를 넣어줄 수 있다.

하지만 인터셉터는 처리 과정이 필터와 다르다.

```java
public class MyInterceptor implements HandlerInterceptor {
 
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) 
    throws Exception {
        // Request, Response를 교체할 수 없고 boolean 값만 반환 가능
        return true;
    }
}
```

디스패처 서블릿이 여러 인터셉터 목록을 가지고 있고, 순차적으로 실행시킨다.
그리고 true를 반환하면 다음 인터셉터가 실행되거나 컨트롤러로 요청이 전달되며, false가 반환되면 요청이 중단된다.
그러므로 다른 request, response 객체를 넘겨줄 수 없다.

### 필터와 인터셉터의 사용 사례

필터(Filter)

-  보안 및 인증/인가 관련 작업

-  모든 요청에 대한 로깅 또는 검사
-  이미지/데이터 압축 및 문자열 인코딩
-  Spring과 분리되어야 하는 기능

필터는 기본적으로 스프링과 무관하게 전역적으로 처리해야 하는 작업들을 처리할 수 있다. 

필터는 인터셉터보다 앞단에서 동작하기 때문에 보안 검사(XSS 방어 등)를 하여 올바른 요청이 아닐 경우 차단할 수 있다. 그러면 스프링 컨테이너까지 요청이 전달되지 못하고 차단되므로 안전성을 더욱 높일 수 있다. 

또한, 필터는 이미지나 데이터의 압축, 문자열 인코딩과 같이 웹 어플리케이션에 전반적으로 사용되는 기능을 구현하기에 적당하다. 

------

인터셉터(Interceptor)

-  세부적인 보안 및 인증/인가 공통 작업

-  API 호출에 대한 로깅 또는 검사
-  Controller로 넘겨주는 정보(데이터)의 가공

인터셉터에서는 클라이언트의 요청과 관련되어 전역적으로 처리해야 하는 작업들을 처리할 수 있다. 

대표적으로 세부적으로 적용해야 하는 인증이나 인가와 같이 예를 들어 특정 그룹의 사용자는 어떤 기능을 사용하지 못하는 경우가 있는데, 이러한 작업들은 컨트롤러로 넘어가기 전에 검사해야 하므로 인터셉터가 처리하기에 적합하다. 

또한 인터셉터는 필터와 다르게 HttpServletRequest나 HttpServletResponse 등과 같은 객체를 제공받으므로 객체 자체를 조작할 수는 없다.

대신 해당 객체가 내부적으로 갖는 값은 조작할 수 있으므로 **컨트롤러로 넘겨주기 위한 정보를 가공**하기에 용이하다. 

예를 들어 JWT 토큰 정보를 파싱해서 컨트롤러에게 사용자의 정보를 제공하도록 가공할 수 있는 것이다.그 외에도 여러 목적으로 API 호출에 대한 정보들을 기록해야 하는 상황에 HttpServletRequest나 HttpServletResponse를 제공해주는 인터셉터는 클라이언트의 IP나 요청 정보들을 기록하기에 용이하다.

## ✔️ 정리

### 필터와 인터셉터의 선택 기준

필터와 인터셉터를 선택할 때는 작업의 성격과 요구 사항을 고려해야 한다. 보안, 인증, 권한 부여와 같은 작업은 필터를 사용하는 것이 적합하다. 반면, 비즈니스 로직과 관련된 작업은 인터셉터를 사용하는 것이 좋다.

예를 들어, 사용자의 로그인 상태를 확인하고, 적절한 권한이 있는지 검증하는 작업은 필터를 사용하여 처리할 수 있다. 그러나 특정 요청에 대해 추가적인 비즈니스 로직을 실행해야 하는 경우에는 인터셉터를 사용하는 것이 더 적합하다.

왜냐하면 필터는 서블릿 컨테이너의 초기 단계에서 작동하며, 인터셉터는 스프링 컨텍스트 내에서 작동하기 때문이다.

필터와 인터셉터를 적절히 조합하여 사용하면, 요청 흐름을 효율적으로 제어할 수 있다.

이러한 선택 기준을 이해하면, 스프링 웹 개발에서 더 나은 설계를 할 수 있다.

------

필터와 인터셉터 모두 **비즈니스 로직과 분리되어 특정 요구사항(보안, 인증, 인코딩 등)을 만족시켜야 할 때 적용**한다.

필터(Filter)는 특정 요청과 컨트롤러에 관계없이 전역적으로 처리해야 하는 작업이나 
웹 어플리케이션에 전반적으로 사용되는 기능을 구현할 때 적용하고,

인터셉터(Interceptor)는 클라이언트의 요청과 관련된 작업에 대해 추가적인 요구사항을 만족해야 할 때 적용한다.
