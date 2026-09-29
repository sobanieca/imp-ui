# Third-party licenses

imp is distributed as a single self-contained binary. That binary, and the vendored files it is
compiled from, **redistribute** other people's work - the JavaScript runtime that executes imp,
pre-bundled npm packages, WebAssembly formatter plugins, the Lucide icon set, and (downloaded on
first use) a Chrome for Testing build. Every one of those carries a license whose notice obligations
imp must honor to stay distributable.

This file lists every third-party component imp bundles or downloads, its version, and its license,
followed by the full text of each license. The last section lists every npm package inside each
prebundled tool, with its license and its copyright lines. imp's own code is licensed under the MIT
License (see `LICENSE`); the terms below apply only to the bundled components.

Run `imp licenses` to print this notice from the binary.

## Bundled components

| Component                     | Version | License       | Source                                                 |
| ----------------------------- | ------- | ------------- | ------------------------------------------------------ |
| Deno (runtime)                | -       | MIT           | https://github.com/denoland/deno                       |
| happy-dom                     | 20.10.6 | MIT           | https://github.com/capricorn86/happy-dom               |
| puppeteer-core                | 24.43.1 | Apache-2.0    | https://github.com/puppeteer/puppeteer                 |
| eslint                        | 10.6.0  | MIT           | https://eslint.org                                     |
| @eslint/js                    | 10.0.1  | MIT           | https://eslint.org                                     |
| globals                       | 17.7.0  | MIT           | https://github.com/sindresorhus/globals                |
| jpeg-js                       | 0.4.4   | BSD-3-Clause  | https://github.com/eugeneware/jpeg-js                  |
| gifenc                        | 1.0.3   | MIT           | https://github.com/mattdesl/gifenc                     |
| esbuild-wasm                  | 0.28.1  | MIT           | https://github.com/evanw/esbuild                       |
| @dprint/formatter             | 0.5.1   | MIT           | https://github.com/dprint/js-formatter                 |
| dprint-plugin-typescript      | 0.96.1  | MIT           | https://github.com/dprint/dprint-plugin-typescript     |
| dprint-plugin-json            | 0.22.0  | MIT           | https://github.com/dprint/dprint-plugin-json           |
| dprint-plugin-markdown        | 0.22.1  | MIT           | https://github.com/dprint/dprint-plugin-markdown       |
| malva (CSS)                   | 0.16.0  | MIT           | https://github.com/g-plane/malva                       |
| jsonc-parser                  | 3.3.1   | MIT           | https://github.com/microsoft/node-jsonc-parser         |
| marked                        | 18.0.12 | MIT           | https://github.com/markedjs/marked                     |
| parse5                        | 8.0.1   | MIT           | https://github.com/inikulin/parse5                     |
| entities                      | 8.1.0   | BSD-2-Clause  | https://github.com/fb55/entities                       |
| markup_fmt (HTML)             | 0.27.3  | MIT           | https://github.com/g-plane/markup_fmt                  |
| pretty_yaml (YAML)            | 0.6.0   | MIT           | https://github.com/g-plane/pretty_yaml                 |
| lax-sql (SQL)                 | 0.3.0   | MIT           | https://github.com/bartlomieju/dprint-plugin-lax-sql   |
| @zip-js/zip-js                | 2.8.26  | BSD-3-Clause  | https://github.com/gildas-lormeau/zip.js               |
| @resvg/resvg-wasm             | 2.6.2   | MPL-2.0       | https://github.com/yisibl/resvg-js                     |
| Lucide (icons)                | 1.38.0  | ISC, MIT      | https://lucide.dev                                     |
| Natural Earth (map data)      | 5.1.2   | Public domain | https://www.naturalearthdata.com                       |
| @std (Deno standard library)  | -       | MIT           | https://github.com/denoland/std                        |
| @deno/esbuild-plugin          | 1.2.1   | MIT           | https://github.com/denoland/deno_esbuild               |
| @deno/loader                  | 0.3.14  | MIT           | https://github.com/denoland/deno-js-loader             |
| Chrome for Testing (download) | pinned  | BSD-3-Clause  | https://github.com/GoogleChromeLabs/chrome-for-testing |

The Chrome for Testing build is not embedded in the binary; imp downloads a pinned,
checksum-verified build once into `~/.imp/browser/` when an e2e spec needs a browser and no system
browser is found. It is Chromium, distributed under the BSD-3-Clause license plus the notices in
Chromium's own `LICENSE` file, which ships inside that download.

Under the Mozilla Public License 2.0, the source form of `@resvg/resvg-wasm` must remain available:
it is retrievable at its published version from https://github.com/yisibl/resvg-js and the npm
registry. imp ships the WebAssembly build unmodified.

imp bundles **only Lucide's icons**, not its runtime code or its web font. Lucide is ISC, and the
icons it inherited from the Feather project are MIT (c) Cole Bemis - both notices are reproduced
below and both travel with the artwork. The drawings themselves are unchanged; imp reshapes each one
into a list of `[element, attributes]` pairs and renames it from `user` to `luUser`. Every app built
with `imp build` carries the notice into its own `LICENSES.txt`, so the attribution reaches whoever
the app is served to.

imp bundles the **1:110m and 1:50m countries, lakes and populated places of Natural Earth, and its
1:10m major and secondary highways**, as the world of the `map` component. Natural Earth is in the
public domain. No permission is needed and no credit is required. imp projects the shapes to Web
Mercator and quantizes them to a grid, which are the generated modules `map-world-110m.js`,
`map-world-50m.js` and `map-roads-10m.js`. The data carries no notice obligation, and none is
reproduced below.

---

## MIT License

Applies to: Deno (© the Deno authors), esbuild-wasm (© Evan Wallace), @dprint/formatter and
dprint-plugin-typescript / -json / -markdown (© David Sherret and dprint contributors), malva /
markup_fmt / pretty_yaml (© Pig Fang / g-plane), lax-sql (© Bartłomiej Iwańczuk and dprint
contributors), @std, @deno/esbuild-plugin and @deno/loader (© the Deno authors), the Feather-derived
Lucide icons (© 2013-present Cole Bemis), and every package that the last section lists under MIT.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## ISC License

Applies to: the Lucide icons (© 2026 Lucide Icons and Contributors), and every package that the last
section lists under ISC. The icons Lucide inherited from Feather are additionally covered by the MIT
License above.

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

## BSD-2-Clause License

Applies to: every package that the last section lists under BSD-2-Clause.

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## BSD-3-Clause License

Applies to: @zip-js/zip-js (© Gildas Lormeau), Chrome for Testing / Chromium (© The Chromium
Authors), and every package that the last section lists under BSD-3-Clause.

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Apache License 2.0

Applies to: every package that the last section lists under Apache-2.0.

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction, and
      distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by the
      copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all other
      entities that control, are controlled by, or are under common control
      with that entity. For the purposes of this definition, "control" means
      (i) the power, direct or indirect, to cause the direction or management
      of such entity, whether by contract or otherwise, or (ii) ownership of
      fifty percent (50%) or more of the outstanding shares, or (iii)
      beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity exercising
      permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation source,
      and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but not limited
      to compiled object code, generated documentation, and conversions to
      other media types.

      "Work" shall mean the work of authorship, whether in Source or Object
      form, made available under the License, as indicated by a copyright
      notice that is included in or attached to the work.

      "Derivative Works" shall mean any work, whether in Source or Object form,
      that is based on (or derived from) the Work and for which the editorial
      revisions, annotations, elaborations, or other modifications represent,
      as a whole, an original work of authorship. For the purposes of this
      License, Derivative Works shall not include works that remain separable
      from, or merely link (or bind by name) to the interfaces of, the Work and
      Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including the original
      version of the Work and any modifications or additions to that Work or
      Derivative Works thereof, that is intentionally submitted to Licensor for
      inclusion in the Work by the copyright owner or by an individual or Legal
      Entity authorized to submit on behalf of the copyright owner. For the
      purposes of this definition, "submitted" means any form of electronic,
      verbal, or written communication sent to the Licensor or its
      representatives, including but not limited to communication on electronic
      mailing lists, source code control systems, and issue tracking systems
      that are managed by, or on behalf of, the Licensor for the purpose of
      discussing and improving the Work, but excluding communication that is
      conspicuously marked or otherwise designated in writing by the copyright
      owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity on
      behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of this
      License, each Contributor hereby grants to You a perpetual, worldwide,
      non-exclusive, no-charge, royalty-free, irrevocable copyright license to
      reproduce, prepare Derivative Works of, publicly display, publicly
      perform, sublicense, and distribute the Work and such Derivative Works in
      Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of this
      License, each Contributor hereby grants to You a perpetual, worldwide,
      non-exclusive, no-charge, royalty-free, irrevocable (except as stated in
      this section) patent license to make, have made, use, offer to sell,
      sell, import, and otherwise transfer the Work, where such license applies
      only to those patent claims licensable by such Contributor that are
      necessarily infringed by their Contribution(s) alone or by combination of
      their Contribution(s) with the Work to which such Contribution(s) was
      submitted. If You institute patent litigation against any entity
      (including a cross-claim or counterclaim in a lawsuit) alleging that the
      Work or a Contribution incorporated within the Work constitutes direct or
      contributory patent infringement, then any patent licenses granted to You
      under this License for that Work shall terminate as of the date such
      litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the Work or
      Derivative Works thereof in any medium, with or without modifications, and
      in Source or Object form, provided that You meet the following conditions:

      (a) You must give any other recipients of the Work or Derivative Works a
          copy of this License; and

      (b) You must cause any modified files to carry prominent notices stating
          that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works that You
          distribute, all copyright, patent, trademark, and attribution notices
          from the Source form of the Work, excluding those notices that do not
          pertain to any part of the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained within
          such NOTICE file, excluding those notices that do not pertain to any
          part of the Derivative Works, in at least one of the following
          places: within a NOTICE text file distributed as part of the
          Derivative Works; within the Source form or documentation, if
          provided along with the Derivative Works; or, within a display
          generated by the Derivative Works, if and wherever such third-party
          notices normally appear. The contents of the NOTICE file are for
          informational purposes only and do not modify the License. You may add
          Your own attribution notices within Derivative Works that You
          distribute, alongside or as an addendum to the NOTICE text from the
          Work, provided that such additional attribution notices cannot be
          construed as modifying the License.

      You may add Your own copyright statement to Your modifications and may
      provide additional or different license terms and conditions for use,
      reproduction, or distribution of Your modifications, or for any such
      Derivative Works as a whole, provided Your use, reproduction, and
      distribution of the Work otherwise complies with the conditions stated in
      this License.

   5. Submission of Contributions. Unless You explicitly state otherwise, any
      Contribution intentionally submitted for inclusion in the Work by You to
      the Licensor shall be under the terms and conditions of this License,
      without any additional terms or conditions. Notwithstanding the above,
      nothing herein shall supersede or modify the terms of any separate license
      agreement you may have executed with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade names,
      trademarks, service marks, or product names of the Licensor, except as
      required for reasonable and customary use in describing the origin of the
      Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or agreed to in
      writing, Licensor provides the Work (and each Contributor provides its
      Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
      ANY KIND, either express or implied, including, without limitation, any
      warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or
      FITNESS FOR A PARTICULAR PURPOSE. You are solely responsible for
      determining the appropriateness of using or redistributing the Work and
      assume any risks associated with Your exercise of permissions under this
      License.

   8. Limitation of Liability. In no event and under no legal theory, whether in
      tort (including negligence), contract, or otherwise, unless required by
      applicable law (such as deliberate and grossly negligent acts) or agreed
      to in writing, shall any Contributor be liable to You for damages,
      including any direct, indirect, special, incidental, or consequential
      damages of any character arising as a result of this License or out of the
      use or inability to use the Work (including but not limited to damages for
      loss of goodwill, work stoppage, computer failure or malfunction, or any
      and all other commercial damages or losses), even if such Contributor has
      been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing the Work
      or Derivative Works thereof, You may choose to offer, and charge a fee for,
      acceptance of support, warranty, indemnity, or other liability obligations
      and/or rights consistent with this License. However, in accepting such
      obligations, You may act only on Your own behalf and on Your sole
      responsibility, not on behalf of any other Contributor, and only if You
      agree to indemnify, defend, and hold each Contributor harmless for any
      liability incurred by, or claims asserted against, such Contributor by
      reason of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   Copyright The Chromium Authors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

---

## Blue Oak Model License 1.0.0

Applies to: every package that the last section lists under BlueOak-1.0.0.

```
# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules. The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice. If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

**_As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim._**
```

---

## Zero-Clause BSD License

Applies to: every package that the last section lists under 0BSD.

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

---

## Mozilla Public License 2.0

Applies to: @resvg/resvg-wasm.

The full text of the Mozilla Public License, version 2.0, is available at
https://mozilla.org/MPL/2.0/. Under this license imp preserves this notice and keeps the source form
of the covered component retrievable at its published version (see the source link in the table
above). imp ships the component unmodified; any modification imp makes to a covered file would be
released under the MPL 2.0.

```
Mozilla Public License Version 2.0

This Source Code Form is subject to the terms of the Mozilla Public License,
v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain
one at https://mozilla.org/MPL/2.0/.

The Covered Software is provided under this License on an "as is" basis, without
warranty of any kind, either expressed, implied, or statutory, including,
without limitation, warranties that the Covered Software is free of defects,
merchantable, fit for a particular purpose or non-infringing. The entire risk as
to the quality and performance of the Covered Software is with You.

For the complete terms and conditions, see https://mozilla.org/MPL/2.0/.
```

---

## Packages inside the prebundled tools

Each prebundled tool below contains the npm packages that it depends on. This list is generated when
the tool is bundled. Each line gives a package, its license, and its copyright lines. imp reads
those lines from the license file and from the header comments of the bundled files of the package.
The text of each license is above.

### happy-dom@20.10.6

```
buffer-image-size@0.6.4 - MIT - Copyright © 2017 Aditya Yadav, http://netroy.in
entities@7.0.1 - BSD-2-Clause - Copyright (c) Felix Böhm
happy-dom@20.10.6 - MIT - Copyright (c) 2019 David Ortner (capricorn86)
whatwg-mimetype@3.0.0 - MIT - Copyright © Domenic Denicola <d@domenic.me>
ws@8.21.0 - MIT - Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com> - Copyright (c) 2013 Arnout Kazemier and contributors - Copyright (c) 2016 Luigi Pinca and contributors
```

### puppeteer-core@24.43.1

```
@puppeteer/browsers@2.13.2 - Apache-2.0 - Copyright 2023 Google Inc. - Copyright 2026 Google Inc. - Copyright 2017 Google Inc.
@tootallnate/quickjs-emscripten@0.23.0 - MIT - quickjs-emscripten copyright (c) 2019 Jake Teton-Landis
agent-base@7.1.4 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
ast-types@0.13.4 - MIT - Copyright (c) 2013 Ben Newman <bn@cs.stanford.edu>
b4a@1.8.1 - Apache-2.0
basic-ftp@5.3.1 - MIT - Copyright (c) 2019 Patrick Juchli
buffer-crc32@0.2.13 - MIT - Copyright (c) 2013 Brian J. Brennan
chromium-bidi@14.0.0 - Apache-2.0
cliui@8.0.1 - ISC - Copyright (c) 2015, Contributors - Copyright (c) npm, Inc. and Contributors
data-uri-to-buffer@6.0.2 - MIT - Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
debug@4.4.3 - MIT - Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> - Copyright (c) 2018-2021 Josh Junon
degenerator@5.0.1 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
end-of-stream@1.4.5 - MIT - Copyright (c) 2014 Mathias Buus
escalade@3.2.0 - MIT - Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
escodegen@2.1.0 - BSD-2-Clause - Copyright (C) 2012 Yusuke Suzuki (twitter: @Constellation) and other contributors. - Copyright (C) 2012-2014 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2015 Ingvar Stepanyan <me@rreverser.com> - Copyright (C) 2014 Ivan Nikulin <ifaaan@gmail.com> - Copyright (C) 2012-2013 Michael Ficarra <escodegen.copyright@michael.ficarra.me> - Copyright (C) 2012-2013 Mathias Bynens <mathias@qiwi.be> - Copyright (C) 2013 Irakli Gozalishvili <rfobic@gmail.com> - Copyright (C) 2012 Robert Gust-Bardon <donate@robert.gust-bardon.org> - Copyright (C) 2012 John Freeman <jfreeman08@gmail.com> - Copyright (C) 2011-2012 Ariya Hidayat <ariya.hidayat@gmail.com> - Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl> - Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com> - Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com> - Copyright (C) 2020 Apple Inc. All rights reserved.
esprima@4.0.1 - BSD-2-Clause - Copyright JS Foundation and other contributors, https://js.foundation/
estraverse@5.3.0 - BSD-2-Clause - Copyright (C) 2012-2013 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
esutils@2.0.3 - BSD-2-Clause - Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2013-2014 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2014 Ivan Nikulin <ifaaan@gmail.com>
events-universal@1.0.1 - Apache-2.0
extract-zip@2.0.1 - BSD-2-Clause - Copyright (c) 2014 Max Ogden and other contributors
fast-fifo@1.3.2 - MIT - Copyright (c) 2019 Mathias Buus
fd-slicer@1.1.0 - MIT - Copyright (c) 2014 Andrew Kelley
get-stream@5.2.0 - MIT - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
get-uri@6.0.5 - MIT - Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
http-proxy-agent@7.0.2 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
https-proxy-agent@7.0.6 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
ip-address@10.2.0 - MIT - Copyright (C) 2011 by Beau Gunderson
lru-cache@7.18.3 - ISC - Copyright (c) 2010-2023 Isaac Z. Schlueter and Contributors
mitt@3.0.1 - MIT - Copyright (c) 2021 Jason Miller
ms@2.1.3 - MIT - Copyright (c) 2020 Vercel, Inc.
netmask@2.1.1 - MIT - Copyright (c) 2011 Olivier Poitrey rs@rhapsodyk.net
once@1.4.0 - ISC - Copyright (c) Isaac Z. Schlueter and Contributors
pac-proxy-agent@7.2.0 - MIT - Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net>
pac-resolver@7.0.1 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
pend@1.2.0 - MIT - Copyright (c) 2014 Andrew Kelley
progress@2.0.3 - MIT - Copyright (c) 2017 TJ Holowaychuk <tj@vision-media.ca> - Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
proxy-agent@6.5.0 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
proxy-from-env@1.1.0 - MIT - Copyright (C) 2016-2018 Rob Wu <rob@robwu.nl>
pump@3.0.4 - MIT - Copyright (c) 2014 Mathias Buus
puppeteer-core@24.43.1 - Apache-2.0 - Copyright (c) 2015-2018 Google, Inc., Netflix, Inc., Microsoft Corp. and contributors - Copyright (c) 2021 Jason Miller - Copyright 2023 Google Inc. - Copyright 2020 Google Inc. - Copyright 2024 Google Inc. - Copyright 2025 Google Inc. - Copyright 2018 Google Inc. - Copyright 2017 Google Inc. - Copyright 2022 Google Inc. - Copyright (c) 2020 Lea Verou - Copyright 2026 Google Inc. - Copyright 2019 Google Inc. - Copyright 2020 Intel Corporation - Copyright 2021 Google Inc.
semver@7.8.5 - ISC - Copyright (c) Isaac Z. Schlueter and Contributors
smart-buffer@4.2.0 - MIT - Copyright (c) 2013-2017 Josh Glazebrook
socks-proxy-agent@8.0.5 - MIT - Copyright (c) 2013 Nathan Rajlich <nathan@tootallnate.net>
socks@2.8.9 - MIT - Copyright (c) 2013 Josh Glazebrook
source-map@0.6.1 - BSD-3-Clause - Copyright (c) 2009-2011, Mozilla Foundation and contributors - Copyright 2011 Mozilla Foundation and contributors - Copyright 2011 The Closure Compiler Authors. All rights reserved. - Copyright 2014 Mozilla Foundation and contributors - Copyright 2009-2011 Mozilla Foundation and contributors
streamx@2.28.0 - MIT - Copyright (c) 2019 Mathias Buus
tar-fs@3.1.3 - MIT - Copyright (c) 2014 Mathias Buus
tar-stream@3.2.0 - MIT - Copyright (c) 2014 Mathias Buus
text-decoder@1.2.7 - Apache-2.0
tslib@2.8.1 - 0BSD - Copyright (c) Microsoft Corporation.
wrappy@1.0.2 - ISC - Copyright (c) Isaac Z. Schlueter and Contributors
ws@8.21.0 - MIT - Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com> - Copyright (c) 2013 Arnout Kazemier and contributors - Copyright (c) 2016 Luigi Pinca and contributors
y18n@5.0.8 - ISC - Copyright (c) 2015, Contributors
yargs-parser@21.1.1 - ISC - Copyright (c) 2016, Contributors
yargs@17.7.3 - MIT - Copyright 2010 James Halliday (mail@substack.net); Modified work Copyright 2014 Contributors (ben@npmjs.com)
yauzl@2.10.0 - MIT - Copyright (c) 2014 Josh Wolfe
```

### eslint@10.6.0 @eslint/js@10.0.1 globals@17.7.0

```
@eslint-community/eslint-utils@4.9.1 - MIT - Copyright (c) 2018 Toru Nagashima
@eslint-community/regexpp@4.12.2 - MIT - Copyright (c) 2018 Toru Nagashima
@eslint/config-array@0.23.5 - Apache-2.0
@eslint/js@10.0.1 - MIT - Copyright OpenJS Foundation and other contributors, <www.openjsf.org>
@eslint/object-schema@3.0.5 - Apache-2.0
@eslint/plugin-kit@0.7.2 - Apache-2.0
acorn-jsx@5.3.2 - MIT - Copyright (C) 2012-2017 by Ingvar Stepanyan
acorn@8.17.0 - MIT - Copyright (C) 2012-2022 by various contributors (see AUTHORS)
ajv@6.15.0 - MIT - Copyright (c) 2015-2017 Evgeny Poberezkin
balanced-match@4.0.4 - MIT - Original code Copyright Julian Gruber <julian@juliangruber.com> - Port to TypeScript Copyright Isaac Z. Schlueter <i@izs.me>
brace-expansion@5.0.7 - MIT - Copyright Julian Gruber <julian@juliangruber.com> - TypeScript port Copyright Isaac Z. Schlueter <i@izs.me>
debug@4.4.3 - MIT - Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> - Copyright (c) 2018-2021 Josh Junon
escape-string-regexp@4.0.0 - MIT - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
eslint-scope@9.1.2 - BSD-2-Clause - Copyright JS Foundation and other contributors, https://js.foundation - Copyright (C) 2012-2013 Yusuke Suzuki (twitter: @Constellation) and other contributors.
eslint-visitor-keys@3.4.3 - Apache-2.0 - Copyright contributors
eslint-visitor-keys@5.0.1 - Apache-2.0 - Copyright contributors
eslint@10.6.0 - MIT - Copyright OpenJS Foundation and other contributors, <www.openjsf.org>
espree@11.2.0 - BSD-2-Clause - Copyright (c) Open JS Foundation
esquery@1.7.0 - BSD-3-Clause - Copyright (c) 2013, Joel Feenstra
esrecurse@4.3.0 - BSD-2-Clause - Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>
estraverse@5.3.0 - BSD-2-Clause - Copyright (C) 2012-2013 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
esutils@2.0.3 - BSD-2-Clause - Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2013-2014 Yusuke Suzuki <utatane.tea@gmail.com> - Copyright (C) 2014 Ivan Nikulin <ifaaan@gmail.com>
fast-deep-equal@3.1.3 - MIT - Copyright (c) 2017 Evgeny Poberezkin
fast-json-stable-stringify@2.1.0 - MIT - Copyright (c) 2017 Evgeny Poberezkin - Copyright (c) 2013 James Halliday
globals@17.7.0 - MIT - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
ignore@5.3.2 - MIT - Copyright (c) 2013 Kael Zhang <i@kael.me>, contributors
json-schema-traverse@0.4.1 - MIT - Copyright (c) 2017 Evgeny Poberezkin
levn@0.4.1 - MIT - Copyright (c) George Zahariev
minimatch@10.2.5 - BlueOak-1.0.0
ms@2.1.3 - MIT - Copyright (c) 2020 Vercel, Inc.
natural-compare@1.4.0 - MIT - Copyright (c) 2012-2015 Lauri Rooden <lauri@rooden.ee>
prelude-ls@1.2.1 - MIT - Copyright (c) George Zahariev
type-check@0.4.0 - MIT - Copyright (c) George Zahariev
uri-js@4.4.1 - BSD-2-Clause - Copyright 2011 Gary Court. All rights reserved. - @license URI.js v4.4.1 (c) 2011 Gary Court. License: http://github.com/garycourt/uri-js
```

### jpeg-js@0.4.4 gifenc@1.0.3

```
gifenc@1.0.3 - MIT - Copyright (c) 2017 Matt DesLauriers
jpeg-js@0.4.4 - BSD-3-Clause - Copyright (c) 2014, Eugene Ware - Copyright (c) 2008, Adobe Systems Incorporated - Copyright 2011 notmasteryet
```

### jsonc-parser@3.3.1

```
jsonc-parser@3.3.1 - MIT - Copyright (c) Microsoft - Copyright (c) Microsoft Corporation. All rights reserved.
```

### marked@18.0.12

```
marked@18.0.12 - MIT - Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/) - Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/) - Copyright © 2004, John Gruber - Copyright (c) 2018-2026, MarkedJS. (MIT License) - Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
```

### parse5@8.0.1

```
entities@8.1.0 - BSD-2-Clause - Copyright (c) Felix Böhm
parse5@8.0.1 - MIT - Copyright (c) 2013-2019 Ivan Nikulin (ifaaan@gmail.com, https://github.com/inikulin)
```
