---
author: sobanieca@gmail.com
base: 7cc727e13cbeca81a5a06bc43d55f01a6b25fbf1
---

Make the application map plain data and name param crumbs through one state.

- appMap() takes children and description only. A top-level home is the index. A map with label, access, nav, group or path throws and names the new binding.
- A param name is unique on its chain: appMap() throws (also across a grafted part), and imp lint reports imp/app-map-unique-params.
- router({ access, need }) replaces access on the node. router({ options }) and the crumb picker from the router are gone.
- shell({ navbar: { hide, groups } }) replaces nav: false and group. A group key that the messages hold is translated.
- The router provides the global state imp.routeLabels. It removes keys whose param left the route or changed, before the new screen runs setup. It commits the trail and writes document.title when the screen settles, and a param crumb with no entry shows the loader until then. In dev it warns about a key that names no param.
- messageFor falls back to defaultMessages, so imp preview names its catalog nodes with default messages.
- imp map prints path, label and description only.
- Docs, skills, ADRs (application-map, route-guards), the scaffold, the example app and the fixtures follow.
