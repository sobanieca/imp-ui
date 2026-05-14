# imp-ui
Imp UI - AI ready frontend framework


Imp UI was built with following in mind:

* Modern web browsers (web api's) and Javascript are very capable and it's possible to write scalable web applications in vanilla Javascript
* Web components are mature enough and allow to properly isolate components on the page
* UI world is very fragmented. One has to search through lots of libraries to select router, state management, UI components, etc. Imp UI is supposed to contain
  all the toolkit inside:
  * linter, formatter (via Deno - it will be compiled with deno and commands like `imp fmt` or `imp lint` should work)
  * Built-in http server to serve your application. Allow to stream logs/network from browser to CLI so AI agents can read most basic stuff without mcp
    involved.
  * Have rich library of UI components ready to use. Something like antd or shadcn
  * Router built-in (Ideally built basing on file paths) For example one has to have structure in project:
modules/moduleA/pages/pageA.js

modules are lazy loaded
* State management built-in - each component can useState. Each component reacts to state change (re-renders). Children components have access to parent
  component state (think of it like each component is context for child components)
* SPA's are great and it was the best thing that happened in industry that frontend got isolated from backend. Server side components are too complex. This
  framework aims to make it possible to use with server rendering in the similar way as MVC was implemented years ago
* Imp UI has to provide a nice UI for styling (theme) of components. It should allow to change colors, borders, shadows etc. all with selextion of 2-3 apps
  (admin dashboard, facebook like and something else)
* Use vanilla js, avoid build step as much as possible, no typescript for now
