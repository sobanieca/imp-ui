# Third-party licenses

imp is distributed as a single self-contained binary. That binary **redistributes** other people's
work: the Rust crates that it is compiled from, the JavaScript engine QuickJS-ng, the browser build of
puppeteer-core, the Lucide icon set, the Natural Earth data, and (downloaded on first use) a Chrome
for Testing build. Every one of those carries a license whose notice obligations imp must honor to
stay distributable.

This file lists every third-party component that imp bundles or downloads, its version, and its
license, followed by the full text of each license. The last two sections list every npm package
inside the vendored browser driver and every Rust crate inside the binary, with its license and its
copyright lines. imp's own code is licensed under the MIT License (see `LICENSE`); the terms below
apply only to the bundled components.

Run `imp licenses` to print this notice from the binary.

## Bundled components

| Component                     | Version | License       | Source                                                 |
| ----------------------------- | ------- | ------------- | ------------------------------------------------------ |
| Rust crates (see last part)   | -       | various       | https://crates.io                                      |
| rolldown (bundler)            | 1.2.13  | MIT           | https://github.com/rolldown/rolldown                   |
| oxc (parser, linter base)     | 0.153.0 | MIT           | https://github.com/oxc-project/oxc                     |
| dprint-plugin-typescript      | 0.96.1  | MIT           | https://github.com/dprint/dprint-plugin-typescript     |
| dprint-plugin-json            | 0.25.2  | MIT           | https://github.com/dprint/dprint-plugin-json           |
| dprint-plugin-markdown        | 0.26.0  | MIT           | https://github.com/dprint/dprint-plugin-markdown       |
| malva (CSS)                   | 0.16.0  | MIT           | https://github.com/g-plane/malva                       |
| markup_fmt (HTML)             | 0.27.5  | MIT           | https://github.com/g-plane/markup_fmt                  |
| pretty_yaml (YAML)            | 0.6.0   | MIT           | https://github.com/g-plane/pretty_yaml                 |
| QuickJS-ng (in rquickjs-sys)  | 0.14.0  | MIT           | https://github.com/quickjs-ng/quickjs                  |
| puppeteer-core (browser)      | 24.43.1 | Apache-2.0    | https://github.com/puppeteer/puppeteer                 |
| Lucide (icons)                | 1.38.0  | ISC, MIT      | https://lucide.dev                                     |
| Natural Earth (map data)      | 5.1.2   | Public domain | https://www.naturalearthdata.com                       |
| QR Code generator library     | -       | MIT           | https://www.nayuki.io/page/qr-code-generator-library   |
| Chrome for Testing (download) | pinned  | BSD-3-Clause  | https://github.com/GoogleChromeLabs/chrome-for-testing |
| Scaffold fonts (10 families)  | -       | OFL-1.1       | https://github.com/google/fonts                        |

The Chrome for Testing build is not embedded in the binary; imp downloads a pinned,
checksum-verified build once into `~/.imp/browser/` when a test needs a browser and no system
browser is found. It is Chromium, distributed under the BSD-3-Clause license plus the notices in
Chromium's own `LICENSE` file, which ships inside that download.

Under the Mozilla Public License 2.0, the source form of a covered crate must remain available: each
one is retrievable at its published version from https://crates.io. imp compiles those crates
unmodified.

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

imp bundles **a QR code encoder that is derived from the QR Code generator library of Project
Nayuki**, as the encoder of the `qrCode` component. The encoder is a JavaScript adaptation of the
TypeScript version of that library. The source file keeps the notice of the library in a legal
comment. So every app built with `imp build` that draws a `qrCode` carries the notice into its own
`LICENSES.txt`. The notice is reproduced below, in the words of the library.

imp bundles **ten font families for the scaffold of `imp init`**: Inter, Manrope, Plus Jakarta Sans,
DM Sans, Outfit, Space Grotesk, Sora, Figtree, Nunito Sans and Work Sans. Each one is the Latin and
the Latin Extended WOFF2 subset that Google Fonts serves, unchanged. All ten are licensed under the
SIL Open Font License 1.1, with no Reserved Font Name. `imp init` copies one family into the new
project, with its own license file beside the font files. The copyright lines and the license text
are reproduced below.

---

## MIT License

Applies to: QuickJS-ng, which `rquickjs-sys` compiles in (Copyright (c) 2017-2026 Fabrice Bellard,
Copyright (c) 2017-2024 Charlie Gordon, Copyright (c) 2023-2026 Ben Noordhuis, Copyright (c)
2023-2026 Saúl Ibarra Corretgé), the Feather-derived Lucide icons (© 2013-present Cole Bemis), the
QR code encoder of `qrCode` (Copyright (c) Project Nayuki), and every crate and package that the
last two sections list under MIT.

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

The QR Code generator library states its notice as follows:

```
QR Code generator library (TypeScript)

Copyright (c) Project Nayuki. (MIT License)
https://www.nayuki.io/page/qr-code-generator-library

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:
- The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
- The Software is provided "as is", without warranty of any kind, express or
  implied, including but not limited to the warranties of merchantability,
  fitness for a particular purpose and noninfringement. In no event shall the
  authors or copyright holders be liable for any claim, damages or other
  liability, whether in an action of contract, tort or otherwise, arising from,
  out of or in connection with the Software or the use or other dealings in the
  Software.
```

---

## ISC License

Applies to: the Lucide icons (© 2026 Lucide Icons and Contributors), and every crate and package that
the last two sections list under ISC. The icons Lucide inherited from Feather are additionally covered by the MIT
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

Applies to: every crate and package that the last two sections list under BSD-2-Clause.

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

Applies to: Chrome for Testing / Chromium (© The Chromium Authors), and every crate and package that
the last two sections list under BSD-3-Clause.

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

Applies to: puppeteer-core, and every crate and package that the last two sections list under
Apache-2.0.

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

## Zero-Clause BSD License

Applies to: every crate and package that the last two sections list under 0BSD.

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

Applies to: every crate that the last section lists under MPL-2.0.

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

## Unicode License v3

Applies to: every crate that the last section lists under Unicode-3.0.

```
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 2020-2024 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.

SPDX-License-Identifier: Unicode-3.0

—

Portions of ICU4X may have been adapted from ICU4C and/or ICU4J.
ICU 1.8.1 to ICU 57.1 © 1995-2016 International Business Machines Corporation and others.
```

---

## zlib License

Applies to: every crate that the last section lists under Zlib.

```
(C) 2024 Trifecta Tech Foundation 

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.
```

---

## Boost Software License 1.0

Applies to: every crate that the last section lists under BSL-1.0.

```
Boost Software License - Version 1.0 - August 17th, 2003

Permission is hereby granted, free of charge, to any person or organization
obtaining a copy of the software and accompanying documentation covered by
this license (the "Software") to use, reproduce, display, distribute,
execute, and transmit the Software, and to prepare derivative works of the
Software, and to permit third-parties to whom the Software is furnished to
do so, all subject to the following:

The copyright notices in the Software and this entire statement, including
the above license grant, this restriction and the following disclaimer,
must be included in all copies of the Software, in whole or in part, and
all derivative works of the Software, unless such copies or derivative
works are solely in the form of machine-executable object code generated by
a source language processor.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT
SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE
FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

---

## Community Data License Agreement - Permissive - Version 2.0

Applies to: every crate that the last section lists under CDLA-Permissive-2.0.

```
# Community Data License Agreement - Permissive - Version 2.0

This is the Community Data License Agreement - Permissive, Version
2.0 (the "agreement"). Data Provider(s) and Data Recipient(s) agree
as follows:

## 1. Provision of the Data

1.1. A Data Recipient may use, modify, and share the Data made
available by Data Provider(s) under this agreement if that Data
Recipient follows the terms of this agreement.

1.2. This agreement does not impose any restriction on a Data
Recipient's use, modification, or sharing of any portions of the
Data that are in the public domain or that may be used, modified,
or shared under any other legal exception or limitation.

## 2. Conditions for Sharing Data

2.1. A Data Recipient may share Data, with or without modifications, so
long as the Data Recipient makes available the text of this agreement
with the shared Data.

## 3. No Restrictions on Results

3.1. This agreement does not impose any restriction or obligations
with respect to the use, modification, or sharing of Results.

## 4. No Warranty; Limitation of Liability

4.1. All Data Recipients receive the Data subject to the following
terms:

THE DATA IS PROVIDED ON AN "AS IS" BASIS, WITHOUT REPRESENTATIONS,
WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED
INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE,
NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

NO DATA PROVIDER SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING
WITHOUT LIMITATION LOST PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE DATA OR RESULTS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

## 5. Definitions

5.1. "Data" means the material received by a Data Recipient under
this agreement.

5.2. "Data Provider" means any person who is the source of Data
provided under this agreement and in reliance on a Data Recipient's
agreement to its terms.

5.3. "Data Recipient" means any person who receives Data directly
or indirectly from a Data Provider and agrees to the terms of this
agreement.

5.4. "Results" means any outcome obtained by computational analysis
of Data, including for example machine learning models and models'
insights.
```

---

## Creative Commons Zero v1.0 Universal

Applies to: every crate that the last section lists under CC0-1.0.

```
Creative Commons CC0 1.0 Universal

<<beginOptional;name=ccOptionalIntro>> CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED HEREUNDER.  <<endOptional>>

Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer exclusive Copyright and Related Rights (defined below) upon the creator and subsequent owner(s) (each and all, an "owner") of an original work of authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for the purpose of contributing to a commons of creative, cultural and scientific works ("Commons") that the public can reliably and without fear of later claims of infringement build upon, modify, incorporate in other works, reuse and redistribute as freely as possible in any form whatsoever and for any purposes, including without limitation commercial purposes. These owners may contribute to the Commons to promote the ideal of a free culture and the further production of creative, cultural and scientific works, or to gain reputation or greater distribution for their Work in part through the use and efforts of others.

For these and/or other purposes and motivations, and without any expectation of additional consideration or compensation, the person associating CC0 with a Work (the "Affirmer"), to the extent that he or she is an owner of Copyright and Related Rights in the Work, voluntarily elects to apply CC0 to the Work and publicly distribute the Work under its terms, with knowledge of his or her Copyright and Related Rights in the Work and the meaning and intended legal effect of CC0 on those rights.

1. Copyright and Related Rights. A Work made available under CC0 may be protected by copyright and related or neighboring rights ("Copyright and Related Rights"). Copyright and Related Rights include, but are not limited to, the following:

     i. the right to reproduce, adapt, distribute, perform, display, communicate, and translate a Work;

     ii. moral rights retained by the original author(s) and/or performer(s);

     iii. publicity and privacy rights pertaining to a person's image or likeness depicted in a Work;

     iv. rights protecting against unfair competition in regards to a Work, subject to the limitations in paragraph 4(a), below;

     v. rights protecting the extraction, dissemination, use and reuse of data in a Work;

     vi. database rights (such as those arising under Directive 96/9/EC of the European Parliament and of the Council of 11 March 1996 on the legal protection of databases, and under any national implementation thereof, including any amended or successor version of such directive); and

     vii. other similar, equivalent or corresponding rights throughout the world based on applicable law or treaty, and any national implementations thereof.

2. Waiver. To the greatest extent permitted by, but not in contravention of, applicable law, Affirmer hereby overtly, fully, permanently, irrevocably and unconditionally waives, abandons, and surrenders all of Affirmer's Copyright and Related Rights and associated claims and causes of action, whether now known or unknown (including existing as well as future claims and causes of action), in the Work (i) in all territories worldwide, (ii) for the maximum duration provided by applicable law or treaty (including future time extensions), (iii) in any current or future medium and for any number of copies, and (iv) for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each member of the public at large and to the detriment of Affirmer's heirs and successors, fully intending that such Waiver shall not be subject to revocation, rescission, cancellation, termination, or any other legal or equitable action to disrupt the quiet enjoyment of the Work by the public as contemplated by Affirmer's express Statement of Purpose.

3. Public License Fallback. Should any part of the Waiver for any reason be judged legally invalid or ineffective under applicable law, then the Waiver shall be preserved to the maximum extent permitted taking into account Affirmer's express Statement of Purpose. In addition, to the extent the Waiver is so judged Affirmer hereby grants to each affected person a royalty-free, non transferable, non sublicensable, non exclusive, irrevocable and unconditional license to exercise Affirmer's Copyright and Related Rights in the Work (i) in all territories worldwide, (ii) for the maximum duration provided by applicable law or treaty (including future time extensions), (iii) in any current or future medium and for any number of copies, and (iv) for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes (the "License"). The License shall be deemed effective as of the date CC0 was applied by Affirmer to the Work. Should any part of the License for any reason be judged legally invalid or ineffective under applicable law, such partial invalidity or ineffectiveness shall not invalidate the remainder of the License, and in such case Affirmer hereby affirms that he or she will not (i) exercise any of his or her remaining Copyright and Related Rights in the Work or (ii) assert any associated claims and causes of action with respect to the Work, in either case contrary to Affirmer's express Statement of Purpose.

4. Limitations and Disclaimers.

     a. No trademark or patent rights held by Affirmer are waived, abandoned, surrendered, licensed or otherwise affected by this document.

     b. Affirmer offers the Work as-is and makes no representations or warranties of any kind concerning the Work, express, implied, statutory or otherwise, including without limitation warranties of title, merchantability, fitness for a particular purpose, non infringement, or the absence of latent or other defects, accuracy, or the present or absence of errors, whether or not discoverable, all to the greatest extent permissible under applicable law.

     c. Affirmer disclaims responsibility for clearing rights of other persons that may apply to the Work or any use thereof, including without limitation any person's Copyright and Related Rights in the Work. Further, Affirmer disclaims responsibility for obtaining any necessary consents, permissions or other rights required for any use of the Work.

     d. Affirmer understands and acknowledges that Creative Commons is not a party to this document and has no duty or obligation with respect to this CC0 or use of the Work.
```

---

## SIL Open Font License 1.1

Applies to: the scaffold fonts of `imp init`.

- Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)
- Copyright 2016 The Nunito Sans Project Authors (https://github.com/Fonthausen/NunitoSans)
- Copyright 2018 The Manrope Project Authors (https://github.com/googlefonts/manrope)
- Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)
- Copyright 2019 The Work Sans Project Authors (https://github.com/weiweihuanghuang/Work-Sans)
- Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)
- Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)
- Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)
- Copyright 2021 The Outfit Project Authors (https://github.com/Outfitio/Outfit-Fonts)
- Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree)

```
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

---

## Packages inside the vendored browser driver

The vendored browser driver contains the npm packages below. This list is generated by
`cargo xtask vendor-puppeteer` when it bundles the driver. Each line gives a package, its license,
and its copyright lines. The text of each license is above.

```
debug@4.4.3 - MIT - Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> - Copyright (c) 2018-2021 Josh Junon
ms@2.1.3 - MIT - Copyright (c) 2020 Vercel, Inc.
puppeteer-core@24.43.1 - Apache-2.0
```

---

## Rust crates inside the binary

Each line below is a Rust crate that the imp binary compiles in. This list is generated by
`cargo xtask licenses` from the dependency graph of the CLI. Each line gives a crate, its license,
and its copyright lines. imp reads those lines from the license files of the crate, and falls back
to the authors of the crate. Where a crate offers a choice of licenses, imp uses it under one of
them. The text of each license is above.

```
adler2@2.0.1 - 0BSD OR MIT OR Apache-2.0 - Copyright (C) Jonas Schievink <jonasschievink@gmail.com>
ahash@0.8.12 - MIT OR Apache-2.0 - Copyright (c) 2018 Tom Kaitchuck
aho-corasick@1.1.5 - Unlicense OR MIT - Copyright (c) 2015 Andrew Gallant
allocator-api2@0.2.21 - MIT OR Apache-2.0 - authors: Zakarum <zaq.dev@icloud.com>
anyhow@1.0.104 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
append-only-vec@0.1.8 - MIT OR Apache-2.0 - authors: David Roundy <daveroundy@gmail.com>
arcstr@1.2.0 - Apache-2.0 OR MIT OR Zlib - Copyright 2016 The Miri Developers - Copyright (c) 2020 Thom Chiovoloni
arrayref@0.3.9 - BSD-2-Clause - Copyright (c) 2015 David Roundy <roundyd@physics.oregonstate.edu>
arrayvec@0.7.8 - MIT OR Apache-2.0 - Copyright (c) Ulrik Sverdrup "bluss" 2015-2023
ast_node@5.0.0 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
async-scoped@0.9.0 - Apache-2.0/MIT - authors: Rajsekar Manokaran <rajsekar@gmail.com>
base-encode@0.3.1 - MIT - authors: Janis Pritzkau <janispritzkau@gmail.com>
base64-simd@0.8.0 - MIT
base64@0.22.1 - MIT OR Apache-2.0 - Copyright (c) 2015 Alice Maz
base64@0.23.1 - MIT OR Apache-2.0 - Copyright (c) 2025 Alice Maz, Marshall Pierce
better_scoped_tls@1.0.1 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
bitflags@2.13.2 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
blake3@1.8.7 - CC0-1.0 OR Apache-2.0 OR Apache-2.0 WITH LLVM-exception - Copyright 2019 Jack O'Connor and Samuel Neves
block-buffer@0.10.4 - MIT OR Apache-2.0 - Copyright (c) 2018-2019 The RustCrypto Project Developers
block2@0.6.2 - MIT - authors: Mads Marquart <mads@marquart.dk>
bumpalo@3.20.3 - MIT OR Apache-2.0 - Copyright (c) 2019 Nick Fitzgerald
bytecount@0.6.9 - Apache-2.0/MIT - Copyright (c) 2017 The bytecount Developers
bytemuck@1.25.2 - Zlib OR Apache-2.0 OR MIT - Copyright (c) 2019 Daniel "Lokathor" Gee.
byteorder-lite@0.1.0 - Unlicense OR MIT - Copyright (c) 2015 Andrew Gallant
byteorder@1.5.0 - Unlicense OR MIT - Copyright (c) 2015 Andrew Gallant
bytes-str@0.2.9 - Apache-2.0 - authors: Donny <kdy1997.dev@gmail.com>
bytes@1.12.1 - MIT - Copyright (c) 2018 Carl Lerche
capacity_builder@0.5.0 - MIT - Copyright (c) 2024 David Sherret
capacity_builder_macros@0.3.0 - MIT
castaway@0.2.4 - MIT - Copyright (c) 2021 Stephen M. Coakley
cfg-if@1.0.5 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
cobs@0.3.0 - MIT OR Apache-2.0 - Copyright (c) 2015 The cobs.rs Developers
color_quant@1.1.0 - MIT - Copyright (c) 2016 PistonDevelopers
combine@4.6.8 - MIT - Copyright (c) 2015 Markus Westerlind
compact_str@0.10.0 - MIT - Copyright (c) 2021 Parker Timmerman
concurrent_lru@0.2.0 - MIT - Copyright (c) 2020 Jianong Zhong
constant_time_eq@0.4.2 - CC0-1.0 OR MIT-0 OR Apache-2.0 - authors: Cesar Eduardo Barros <cesarb@cesarb.eti.br>
core-foundation-sys@0.8.7 - MIT OR Apache-2.0 - Copyright (c) 2012-2013 Mozilla Foundation
core-foundation@0.10.1 - MIT OR Apache-2.0 - Copyright (c) 2012-2013 Mozilla Foundation
countme@3.0.1 - MIT OR Apache-2.0 - authors: Aleksey Kladov <aleksey.kladov@gmail.com>
cow-utils@0.1.3 - MIT - Copyright (c) 2020 Ingvar Stepanyan
cpufeatures@0.2.17 - MIT OR Apache-2.0 - Copyright (c) 2020-2025 The RustCrypto Project Developers
cpufeatures@0.3.1 - MIT OR Apache-2.0 - Copyright (c) 2020-2026 The RustCrypto Project Developers
crc32fast@1.5.2 - MIT OR Apache-2.0 - Copyright (c) 2018 Sam Rijs, Alex Crichton and contributors
crossbeam-deque@0.8.8 - MIT OR Apache-2.0 - Copyright (c) 2019 The Crossbeam Project Developers
crossbeam-epoch@0.9.21 - MIT OR Apache-2.0 - Copyright (c) 2019 The Crossbeam Project Developers
crossbeam-utils@0.8.23 - MIT OR Apache-2.0 - Copyright (c) 2019 The Crossbeam Project Developers
crypto-common@0.1.7 - MIT OR Apache-2.0 - Copyright (c) 2021 RustCrypto Developers
css_dataset@0.4.1 - MIT - authors: Pig Fang <g-plane@hotmail.com>
ctrlc@3.5.2 - MIT/Apache-2.0 - Copyright 2017 CtrlC developers
dashmap@6.2.1 - MIT - Copyright (c) 2019 Acrimon
data-url@0.3.2 - MIT OR Apache-2.0 - Copyright (c) 2013-2025 The rust-url developers
deno_ast@0.53.3 - MIT - Copyright (c) 2018-2024 the Deno authors
deno_error@0.7.3 - MIT - Copyright (c) 2018-2024 the Deno authors
deno_error_macro@0.7.3 - MIT - authors: the Deno authors
deno_media_type@0.4.0 - MIT - Copyright (c) 2018-2025 the Deno authors
deno_terminal@0.2.3 - MIT - Copyright (c) 2018-2024 the Deno authors
derive_more-impl@2.1.1 - MIT - Copyright (c) 2016 Jelte Fennema
derive_more@2.1.1 - MIT - Copyright (c) 2016 Jelte Fennema
digest@0.10.7 - MIT OR Apache-2.0 - Copyright (c) 2017 Artyom Pavlov
dispatch2@0.3.1 - Zlib OR Apache-2.0 OR MIT - authors: Mads Marquart <mads@marquart.dk>, Mary <mary@mary.zone>
displaydoc@0.2.7 - MIT OR Apache-2.0 - authors: Jane Lusby <jlusby@yaah.dev>
dprint-core-macros@0.1.0 - MIT - Copyright (c) 2019-2024 David Sherret
dprint-core@0.67.4 - MIT - Copyright (c) 2019-2023 David Sherret
dprint-core@0.69.1 - MIT - Copyright (c) 2019 David Sherret
dprint-core@0.70.0 - MIT - Copyright (c) 2019 David Sherret
dprint-plugin-json@0.25.2 - MIT - Copyright (c) 2020 David Sherret
dprint-plugin-markdown@0.26.0 - MIT - Copyright (c) 2020-2023 David Sherret
dprint-plugin-typescript@0.96.1 - MIT - Copyright (c) 2019-2022 David Sherret
dprint-swc-ext@0.26.1 - MIT - authors: David Sherret <dsherret@gmail.com>
dragonbox_ecma@0.1.12 - Apache-2.0 WITH LLVM-exception OR BSL-1.0 - authors: David Tolnay <dtolnay@gmail.com>, magic-akari <akari.ccino@gmail.com>
either@1.19.0 - MIT OR Apache-2.0 - Copyright (c) 2015
embedded-io@0.4.0 - MIT OR Apache-2.0 - Copyright (c) 2022 The embedded-io authors
embedded-io@0.6.1 - MIT OR Apache-2.0 - Copyright (c) 2023 The embedded-io authors
endian-type@0.2.0 - MIT - Copyright (c) 2015
equivalent@1.0.2 - Apache-2.0 OR MIT - Copyright (c) 2016--2023
errno@0.3.14 - MIT OR Apache-2.0 - Copyright (c) 2014 Chris Wong
escape-simd@0.1.0 - MIT
euclid@0.22.14 - MIT OR Apache-2.0 - Copyright (c) 2012-2013 Mozilla Foundation
fast-glob@1.1.2 - MIT - authors: shulaoda <laipichan@qq.com>, fast-glob contributors
fastrand@2.5.0 - Apache-2.0 OR MIT - authors: Stjepan Glavina <stjepang@gmail.com>
fdeflate@0.3.7 - MIT OR Apache-2.0 - authors: The image-rs Developers
filetime@0.2.29 - MIT/Apache-2.0 - Copyright (c) 2014 Alex Crichton
fixedbitset@0.5.7 - MIT OR Apache-2.0 - Copyright (c) 2015-2017
flate2@1.1.10 - MIT OR Apache-2.0 - Copyright (c) 2014-2026 Alex Crichton
float-cmp@0.10.0 - MIT - Copyright (c) 2014-2020 Optimal Computing (NZ) Ltd
float-cmp@0.9.0 - MIT - Copyright (c) 2014-2020 Optimal Computing (NZ) Ltd
foldhash@0.1.5 - Zlib - Copyright (c) 2024 Orson Peters
foldhash@0.2.0 - Zlib - Copyright (c) 2024 Orson Peters
form_urlencoded@1.2.2 - MIT OR Apache-2.0 - Copyright (c) 2013-2016 The rust-url developers
from_variant@3.0.0 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
fsevent-sys@4.1.0 - MIT - Copyright (c) 2015 Pierre Baillet
futures-channel@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-core@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-executor@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-io@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-macro@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-sink@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-task@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures-util@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
futures@0.3.34 - MIT OR Apache-2.0 - Copyright (c) 2016 Alex Crichton - Copyright (c) 2017 The Tokio Authors
generic-array@0.14.7 - MIT - Copyright (c) 2015 Bartłomiej Kamiński
getrandom@0.2.17 - MIT OR Apache-2.0 - Copyright (c) 2018-2024 The rust-random Project Developers - Copyright (c) 2014 The Rust Project Developers
getrandom@0.4.3 - MIT OR Apache-2.0 - Copyright (c) 2018-2026 The rust-random Project Developers - Copyright (c) 2014 The Rust Project Developers
gif@0.13.3 - MIT OR Apache-2.0 - Copyright (c) 2015 nwin
gif@0.14.2 - MIT OR Apache-2.0 - Copyright (c) 2015 nwin
halfbrown@0.4.0 - Apache-2.0/MIT - authors: Heinz N. Gies <heinz@licenser.net>
hashbrown@0.14.5 - MIT OR Apache-2.0 - Copyright (c) 2016 Amanieu d'Antras
hashbrown@0.15.5 - MIT OR Apache-2.0 - Copyright (c) 2016 Amanieu d'Antras
hashbrown@0.16.1 - MIT OR Apache-2.0 - Copyright (c) 2016 Amanieu d'Antras
hashbrown@0.17.1 - MIT OR Apache-2.0 - Copyright (c) 2016 Amanieu d'Antras
heck@0.5.0 - MIT OR Apache-2.0 - Copyright (c) 2015 The Rust Project Developers
hmac-sha1-compact@1.1.8 - ISC - Copyright (c) 2021-2026, Frank Denis.
hstr@3.0.6 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
http@1.5.0 - MIT OR Apache-2.0 - Copyright 2017 http-rs authors - Copyright (c) 2017 http-rs authors
httparse@1.10.1 - MIT OR Apache-2.0 - Copyright (c) 2015-2025 Sean McArthur
icu_collections@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_locale_core@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_locale_fallback@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_locale_fallback_data@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_normalizer@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_normalizer_data@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_properties@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_properties_data@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_provider@2.3.1 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_segmenter@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
icu_segmenter_data@2.3.0 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
idna@1.1.0 - MIT OR Apache-2.0 - Copyright (c) 2013-2025 The rust-url developers
idna_adapter@1.2.2 - Apache-2.0 OR MIT - Copyright (c) The rust-url developers
if-addrs@0.15.0 - MIT OR BSD-3-Clause - Copyright 2018 MaidSafe.net limited. - Copyright 2020 messense
image-webp@0.2.4 - MIT OR Apache-2.0
image@0.25.10 - MIT OR Apache-2.0 - authors: The image-rs Developers
imagesize@0.15.0 - MIT - Copyright (c) 2017 Maiddog
indexmap@2.14.2 - Apache-2.0 OR MIT - Copyright (c) 2016--2017
infer@0.22.0 - MIT - Copyright (c) 2019 Bojan
inotify-sys@0.1.8 - ISC - Copyright (c) Hanno Braun and contributors
inotify@0.11.5 - ISC - Copyright (c) Hanno Braun and contributors
is-macro@0.3.8 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
itertools@0.14.0 - MIT OR Apache-2.0 - Copyright (c) 2015
itertools@0.15.0 - MIT OR Apache-2.0 - Copyright (c) 2015
itoa@1.0.18 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
jni-macros@0.22.4 - MIT OR Apache-2.0
jni-sys-macros@0.4.1 - MIT OR Apache-2.0 - authors: Robert Bragg <robert@sixbynine.org>
jni-sys@0.4.1 - MIT OR Apache-2.0 - Copyright (c) 2015 The rust-jni-sys Developers
jni@0.22.4 - MIT OR Apache-2.0 - authors: jni team
js-sys@0.3.106 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
json-escape-simd@3.1.2 - MIT
json-strip-comments@3.1.2 - Apache-2.0
jsonc-parser@0.34.0 - MIT - Copyright (c) 2020 David Sherret
kqueue-sys@1.1.2 - MIT - Copyright (c) 2016 William Orr <will@worrbase.com>
kqueue@1.2.1 - MIT - Copyright (c) 2016 William Orr <will@worrbase.com>
kurbo@0.13.1 - Apache-2.0 OR MIT - Copyright (c) 2018 Raph Levien
lax-core@0.3.0 - MIT
lax-sql@0.3.0 - MIT - Copyright (c) 2026 the lax-sql authors
lazy-regex-proc_macros@3.6.2 - MIT - authors: Canop <cano.petrole@gmail.com>
lazy-regex@3.6.2 - MIT - Copyright (c) 2018 Canop
lazy_static@1.5.1 - MIT OR Apache-2.0 - authors: Marvin Löbel <loebel.marvin@gmail.com>
libc@0.2.190 - MIT OR Apache-2.0 - Copyright (c) The Rust Project Developers
linux-raw-sys@0.12.1 - Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT - authors: Dan Gohman <dev@sunfishcode.online>
litemap@0.8.3 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
lock_api@0.4.14 - MIT OR Apache-2.0 - Copyright (c) 2016 The Rust Project Developers
log@0.4.34 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
malva@0.16.0 - MIT - authors: Pig Fang <g-plane@hotmail.com>
markup_fmt@0.27.5 - MIT - authors: Pig Fang <g-plane@hotmail.com>
memchr@2.8.3 - Unlicense OR MIT - Copyright (c) 2015 Andrew Gallant
mime@0.3.17 - MIT OR Apache-2.0 - Copyright (c) 2014 Sean McArthur
miniz_oxide@0.8.9 - MIT OR Zlib OR Apache-2.0 - Copyright 2013-2014 RAD Game Tools and Valve Software - Copyright 2010-2014 Rich Geldreich and Tenacious Software LLC - Copyright (c) 2017 Frommi - Copyright (c) 2017-2024 oyvindln - Copyright (c) 2020 Frommi
miniz_oxide@0.9.1 - MIT OR Zlib OR Apache-2.0 - Copyright 2013-2014 RAD Game Tools and Valve Software - Copyright 2010-2014 Rich Geldreich and Tenacious Software LLC - Copyright (c) 2017 Frommi - Copyright (c) 2017-2024 oyvindln - Copyright (c) 2020 Frommi
mio@1.2.4 - MIT - Copyright (c) 2014 Carl Lerche and other MIO contributors
moxcms@0.8.1 - BSD-3-Clause OR Apache-2.0 - Copyright 2024 Radzivon Bartoshyk - Copyright (c) Radzivon Bartoshyk. All rights reserved.
new_debug_unreachable@1.0.6 - MIT - Copyright (c) 2015 Jonathan Reem
nibble_vec@0.1.0 - MIT - Copyright (c) 2015 Michael Sproul
nix@0.31.3 - MIT - Copyright (c) 2015 Carl Lerche + nix-rust Authors
nodejs-built-in-modules@1.0.0 - MIT - authors: Boshen <boshenc@gmail.com>
nodejs-semver@7.0.0 - Apache-2.0 - Copyright [2021] Felipe Seré and Kat Marchán - Copyright [2023] cijiugechu
nom@8.0.0 - MIT - Copyright (c) 2014-2019 Geoffroy Couprie
nonmax@0.5.5 - MIT OR Apache-2.0 - Copyright (c) 2020 Lucien Greathouse
notify-types@2.1.0 - MIT OR Apache-2.0 - Copyright 2023 Notify Contributors - Copyright (c) 2023 Notify Contributors
notify@8.2.0 - CC0-1.0 - authors: Félix Saparelli <me@passcod.name>, Daniel Faust <hessijames@gmail.com>, Aron Heinecke <Ox0p54r36@t-online.de>
nu-ansi-term@0.50.3 - MIT - Copyright (c) 2014 Benjamin Sago - Copyright (c) 2021-2022 The Nushell Project Developers
num-bigint@0.4.8 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
num-bigint@0.5.1 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
num-integer@0.1.47 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
num-traits@0.2.19 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
objc2-encode@4.1.0 - MIT - authors: Mads Marquart <mads@marquart.dk>
objc2@0.6.5 - MIT - authors: Mads Marquart <mads@marquart.dk>
once_cell@1.21.4 - MIT OR Apache-2.0 - authors: Aleksey Kladov <aleksey.kladov@gmail.com>
openssl-probe@0.2.1 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
outref@0.5.2 - MIT - Copyright (c) 2022 Nugine
oxc-browserslist@5.0.1 - MIT - authors: Boshen <boshenc@gmail.com>, Pig Fang <g-plane@hotmail.com>
oxc@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_allocator@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_ast@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_ast_macros@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_ast_visit@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_codegen@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_compat@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_data_structures@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_diagnostics@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_ecmascript@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_estree@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_index@5.0.0 - MIT - authors: Boshen <boshenc@gmail.com>
oxc_isolated_declarations@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_mangler@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_minifier@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_parser@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_regular_expression@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_resolver@11.24.3 - MIT - authors: Boshen <boshenc@gmail.com>
oxc_semantic@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_sourcemap@9.0.0 - BSD-3-Clause - Copyright (c) 2016 by Armin Ronacher.
oxc_span@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_str@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_syntax@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_transformer@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_transformer_plugins@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
oxc_traverse@0.153.0 - MIT - authors: Boshen <boshenc@gmail.com>, Oxc contributors
parking_lot_core@0.9.12 - MIT OR Apache-2.0 - Copyright (c) 2016 The Rust Project Developers
pathdiff@0.2.3 - MIT/Apache-2.0 - Copyright 2017 The Rust Project Developers
percent-encoding@2.3.2 - MIT OR Apache-2.0 - Copyright (c) 2013-2025 The rust-url developers
petgraph@0.8.3 - MIT OR Apache-2.0 - Copyright (c) 2015
phf@0.11.3 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf@0.14.0 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_generator@0.11.3 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_generator@0.14.0 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_macros@0.11.3 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_macros@0.14.0 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_shared@0.11.3 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
phf_shared@0.14.0 - MIT - Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi
pico-args@0.5.0 - MIT - Copyright (c) 2019 Yevhenii Reizner
pin-project-internal@1.1.13 - Apache-2.0 OR MIT
pin-project-lite@0.2.17 - Apache-2.0 OR MIT
pin-project@1.1.13 - Apache-2.0 OR MIT
png@0.18.1 - MIT OR Apache-2.0 - Copyright (c) 2015 nwin
pnp@0.12.12 - BSD-2-Clause - Copyright (c) 2016-present, Yarn Contributors.
polycool@0.4.0 - MIT OR Apache-2.0 - Copyright (c) 2018 Raph Levien
postcard@1.1.3 - MIT OR Apache-2.0 - Copyright (c) 2019 Anthony James Munns
potential_utf@0.1.6 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
pretty_yaml@0.6.0 - MIT - authors: Pig Fang <g-plane@hotmail.com>
proc-macro2@1.0.107 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>, Alex Crichton <alex@alexcrichton.com>
psm@0.1.32 - MIT OR Apache-2.0 - Copyright © 2018, Simonas Kazlauskas
pulldown-cmark-escape@0.11.0 - MIT - Copyright 2015 Google Inc. All rights reserved.
pulldown-cmark@0.13.4 - MIT - Copyright 2015 Google Inc. All rights reserved.
pxfm@0.1.30 - BSD-3-Clause OR Apache-2.0 - Copyright 2024 Radzivon Bartoshyk - Copyright (c) Radzivon Bartoshyk. All rights reserved.
quick-error@2.0.1 - MIT/Apache-2.0 - Copyright (c) 2015 The quick-error Developers
quote@1.0.47 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
r-efi@6.0.0 - MIT OR Apache-2.0 OR LGPL-2.1-or-later
radix_trie@0.3.0 - MIT - Copyright (c) 2015 Michael Sproul
raffia@0.12.3 - MIT - authors: Pig Fang <g-plane@hotmail.com>
raffia_macro@0.2.0 - MIT - authors: Pig Fang <g-plane@hotmail.com>
rand@0.8.8 - MIT OR Apache-2.0 - Copyright 2018 Developers of the Rand project - Copyright (c) 2014 The Rust Project Developers
rand_core@0.6.4 - MIT OR Apache-2.0 - Copyright 2018 Developers of the Rand project - Copyright (c) 2014 The Rust Project Developers
rayon-core@1.13.0 - MIT OR Apache-2.0 - Copyright (c) 2010 The Rust Project Developers
rayon@1.12.0 - MIT OR Apache-2.0 - Copyright (c) 2010 The Rust Project Developers
redox_syscall@0.5.18 - MIT - Copyright (c) 2017 Redox OS Developers
ref-cast-impl@1.0.27 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
ref-cast@1.0.27 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
regex-automata@0.4.18 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
regex-syntax@0.8.11 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
regex@1.13.1 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
regress@0.12.0 - MIT OR Apache-2.0 - Copyright 2020 ridiculous_fish - Copyright (c) 2020 ridiculous_fish
relative-path@2.0.2 - MIT OR Apache-2.0 - Copyright (c) 2014 The Rust Project Developers
resvg@0.48.1 - Apache-2.0 OR MIT - Copyright 2017 the Resvg Authors
rgb@0.8.53 - MIT - Copyright (c) 2019 Kornel
ring@0.17.14 - Apache-2.0 AND ISC - Copyright (c) 2009 The Go Authors. All rights reserved. - Copyright 2015 The Chromium Authors. All rights reserved. - Copyright 2015-2025 Brian Smith.
rolldown-ariadne@0.6.0 - MIT - Copyright (c) 2021-2022 Joshua Barretto
rolldown@1.2.13 - MIT
rolldown_common@1.2.13 - MIT
rolldown_dev_common@1.2.13 - MIT
rolldown_devtools@1.2.13 - MIT
rolldown_devtools_action@1.2.13 - MIT
rolldown_ecmascript@1.2.13 - MIT
rolldown_ecmascript_utils@1.2.13 - MIT
rolldown_error@1.2.13 - MIT
rolldown_fs@1.2.13 - MIT
rolldown_plugin@1.2.13 - MIT
rolldown_plugin_asset_module@1.2.13 - MIT
rolldown_plugin_chunk_import_map@1.2.13 - MIT
rolldown_plugin_copy_module@1.2.13 - MIT
rolldown_plugin_data_url@1.2.13 - MIT
rolldown_plugin_hmr@1.2.13 - MIT
rolldown_plugin_lazy_compilation@1.2.13 - MIT
rolldown_plugin_oxc_runtime@1.2.13 - MIT
rolldown_plugin_utils@1.2.13 - MIT
rolldown_resolver@1.2.13 - MIT
rolldown_sourcemap@1.2.13 - MIT
rolldown_std_utils@1.2.13 - MIT
rolldown_tracing@1.2.13 - MIT
rolldown_utils@1.2.13 - MIT
ropey@1.6.1 - MIT - Copyright (c) 2017 Nathan Vegdahl
rowan@0.16.1 - MIT OR Apache-2.0 - authors: Aleksey Kladov <aleksey.kladov@gmail.com>
roxmltree@0.21.1 - MIT OR Apache-2.0 - Copyright (c) 2018 Yevhenii Reizner
rquickjs-core@0.14.0 - MIT - authors: Mees Delzenne <mees.delzenne@gmail.com>, K. <kayo@illumium.org>
rquickjs-sys@0.14.0 - MIT - authors: Mees Delzenne <mees.delzenne@gmail.com>
rquickjs@0.14.0 - MIT - Copyright (c) 2020 Mees Delzenne - Copyright (c) 2025 Rquickjs Contributors
rustc-hash@1.1.0 - Apache-2.0/MIT - authors: The Rust Project Developers
rustc-hash@2.1.3 - Apache-2.0 OR MIT - authors: The Rust Project Developers
rustix@1.1.5 - Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT - authors: Dan Gohman <dev@sunfishcode.online>, Jakub Konka <kubkon@jakubkonka.com>
rustls-native-certs@0.8.4 - Apache-2.0 OR ISC OR MIT - Copyright (c) 2016, Joseph Birr-Pixton <jpixton@gmail.com> - Copyright (c) 2016 Joseph Birr-Pixton <jpixton@gmail.com>
rustls-pki-types@1.15.1 - MIT OR Apache-2.0 - Copyright 2023 Dirkjan Ochtman - Copyright (c) 2023 Dirkjan Ochtman <dirkjan@ochtman.nl>
rustls-platform-verifier-android@0.2.0 - MIT OR Apache-2.0
rustls-platform-verifier@0.7.1 - MIT OR Apache-2.0 - Copyright (c) 2022 1Password
rustls-webpki@0.103.15 - ISC - Copyright 2015 Brian Smith.
rustls@0.23.45 - Apache-2.0 OR ISC OR MIT - Copyright (c) 2016, Joseph Birr-Pixton <jpixton@gmail.com> - Copyright (c) 2016 Joseph Birr-Pixton <jpixton@gmail.com>
rustversion@1.0.23 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
ryu@1.0.23 - Apache-2.0 OR BSL-1.0 - authors: David Tolnay <dtolnay@gmail.com>
same-file@1.0.6 - Unlicense/MIT - Copyright (c) 2017 Andrew Gallant
schannel@0.1.29 - MIT - Copyright (c) 2015 steffengy
scoped-tls@1.0.1 - MIT/Apache-2.0 - Copyright (c) 2014 Alex Crichton
scopeguard@1.2.0 - MIT OR Apache-2.0 - Copyright (c) 2016-2019 Ulrik Sverdrup "bluss" and scopeguard developers
security-framework-sys@2.17.0 - MIT OR Apache-2.0 - Copyright (c) 2015 Steven Fackler
security-framework@3.7.0 - MIT OR Apache-2.0 - Copyright (c) 2015 Steven Fackler
self_cell@1.3.0 - Apache-2.0 OR GPL-2.0-only - Copyright (C) 1989, 1991 Free Software Foundation, Inc.,
seq-macro@0.3.6 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
serde@1.0.229 - MIT OR Apache-2.0 - authors: Erick Tryzelaar <erick.tryzelaar@gmail.com>, David Tolnay <dtolnay@gmail.com>
serde_core@1.0.229 - MIT OR Apache-2.0 - authors: Erick Tryzelaar <erick.tryzelaar@gmail.com>, David Tolnay <dtolnay@gmail.com>
serde_derive@1.0.229 - MIT OR Apache-2.0 - authors: Erick Tryzelaar <erick.tryzelaar@gmail.com>, David Tolnay <dtolnay@gmail.com>
serde_json@1.0.152 - MIT OR Apache-2.0
sha1@0.10.7 - MIT OR Apache-2.0 - Copyright (c) 2006-2009 Graydon Hoare - Copyright (c) 2009-2013 Mozilla Foundation - Copyright (c) 2016 Artyom Pavlov
sha2@0.10.9 - MIT OR Apache-2.0 - Copyright (c) 2006-2009 Graydon Hoare - Copyright (c) 2009-2013 Mozilla Foundation - Copyright (c) 2016 Artyom Pavlov
sharded-slab@0.1.7 - MIT - Copyright (c) 2019 Eliza Weisman
simd-adler32@0.3.10 - MIT - Copyright (c) [2021] [Marvin Countryman]
simd-json@0.18.1 - Apache-2.0 OR MIT - authors: Heinz N. Gies <heinz@licenser.net>, Sunny Gleason
simd_cesu8@1.2.0 - Apache-2.0 OR MIT - authors: Sean C. Roach <me@seancroach.dev>
simdutf8@0.1.5 - MIT OR Apache-2.0 - authors: Hans Kratz <hans@appfour.com>
simplecss@0.2.2 - Apache-2.0 OR MIT - Copyright (c) 2018 Reizner Evgeniy
siphasher@0.3.11 - MIT/Apache-2.0 - Copyright 2012-2016 The Rust Project Developers. - Copyright 2016-2023 Frank Denis.
siphasher@1.0.4 - MIT OR Apache-2.0 - Copyright 2012-2016 The Rust Project Developers. - Copyright 2016-2026 Frank Denis.
slab@0.4.12 - MIT - Copyright (c) 2019 Carl Lerche
smallvec@1.16.3 - MIT OR Apache-2.0 - Copyright (c) 2018 The Servo Project Developers
smartstring@1.0.1 - MPL-2.0+ - authors: Bodil Stokke <bodil@bodil.org>
smawk@0.3.3 - MIT - Copyright (c) 2017 Martin Geisler
stable_deref_trait@1.2.1 - MIT OR Apache-2.0 - Copyright (c) 2017 Robert Grosse
stacker@0.1.25 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
static_assertions@1.1.0 - MIT OR Apache-2.0 - Copyright (c) 2017 Nikolai Vazquez
str_indices@0.4.4 - MIT OR Apache-2.0 - authors: Nathan Vegdahl <cessen@cessen.com>
strict-num@0.1.1 - MIT - Copyright (c) 2022 Yevhenii Reizner
string_enum@1.0.2 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
string_wizard@1.2.13 - MIT
subtle@2.6.1 - BSD-3-Clause - Copyright (c) 2016-2017 Isis Agora Lovecruft, Henry de Valence. All rights reserved. - Copyright (c) 2016-2024 Isis Agora Lovecruft. All rights reserved.
sugar_path@3.0.0 - MIT - Copyright (c) 2022 HeYunfei
svgtypes@0.16.1 - Apache-2.0 OR MIT - Copyright (c) 2018 Yevhenii Reizner
swc_atoms@9.0.0 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_common@17.0.1 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_ecma_ast@18.0.0 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_ecma_lexer@26.0.0 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_ecma_parser@27.0.7 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_eq_ignore_macros@1.0.1 - Apache-2.0 - authors: 강동윤 <kdy1@dudy.kr>
swc_macros_common@1.0.1 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
swc_visit@2.0.2 - Apache-2.0 - authors: 강동윤 <kdy1997.dev@gmail.com>
syn@1.0.109 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
syn@2.0.119 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
syn@3.0.7 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
synstructure@0.14.0 - MIT - Copyright 2016 Nika Layzell
tar@0.4.46 - MIT OR Apache-2.0 - Copyright (c) The tar-rs Project Contributors
termcolor@1.4.1 - Unlicense OR MIT - Copyright (c) 2015 Andrew Gallant
text-size@1.1.1 - MIT OR Apache-2.0 - authors: Aleksey Kladov <aleksey.kladov@gmail.com>, Christopher Durham (CAD97) <cad97@cad97.com>
text_lines@0.6.0 - MIT - Copyright (c) 2021 David Sherret
textwrap@0.16.4 - MIT - Copyright (c) 2016 Martin Geisler
thiserror-impl@2.0.21 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
thiserror@2.0.21 - MIT OR Apache-2.0 - authors: David Tolnay <dtolnay@gmail.com>
thread_local@1.1.10 - MIT OR Apache-2.0 - Copyright (c) 2016 The Rust Project Developers
tiny-skia-path@0.12.0 - BSD-3-Clause - Copyright (c) 2011 Google Inc. All rights reserved. - Copyright (c) 2020 Yevhenii Reizner All rights reserved.
tiny-skia@0.12.0 - BSD-3-Clause - Copyright (c) 2011 Google Inc. All rights reserved. - Copyright (c) 2020 Yevhenii Reizner All rights reserved.
tiny_pretty@0.2.1 - MIT - Copyright (c) 2023-present Pig Fang
tiny_pretty@0.4.3 - MIT - Copyright (c) 2023-present Pig Fang
tinystr@0.8.4 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
tokio-macros@2.7.2 - MIT - Copyright (c) 2019 Yoshua Wuyts - Copyright (c) Tokio Contributors
tokio@1.53.2 - MIT - Copyright (c) Tokio Contributors
tracing-attributes@0.1.31 - MIT - Copyright (c) 2019 Tokio Contributors
tracing-core@0.1.36 - MIT - Copyright (c) 2019 Tokio Contributors
tracing-serde@0.2.0 - MIT - Copyright (c) 2019 Tokio Contributors
tracing-subscriber@0.3.23 - MIT - Copyright (c) 2019 Tokio Contributors
tracing@0.1.44 - MIT - Copyright (c) 2019 Tokio Contributors
triomphe@0.1.17 - MIT OR Apache-2.0 - Copyright (c) 2019 Manish Goregaokar
ts-rs-macros@12.0.1 - MIT - authors: Moritz Bischof <moritz.bischof1@gmail.com>
ts-rs@12.0.1 - MIT - authors: Moritz Bischof <moritz.bischof1@gmail.com>
typed-path@0.12.3 - MIT OR Apache-2.0 - authors: Chip Senkbeil <chip@senkbeil.org>
typedmap@0.6.0 - MIT OR Apache-2.0 - authors: Konrad Gołuchowski <kodieg@gmail.com>
typenum@1.20.1 - MIT OR Apache-2.0 - Copyright 2014 Paho Lurie-Gregg - Copyright (c) 2014 Paho Lurie-Gregg
unicase@2.10.0 - MIT OR Apache-2.0 - Copyright (c) 2014-2026 Sean McArthur
unicode-id-start@1.5.0 - (MIT OR Apache-2.0) AND Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 1991-2023 Unicode, Inc.
unicode-ident@1.0.26 - (MIT OR Apache-2.0) AND Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 1991-2023 Unicode, Inc.
unicode-segmentation@1.13.3 - MIT OR Apache-2.0 - Copyright (c) 2015 The Rust Project Developers
unicode-width@0.2.2 - MIT OR Apache-2.0 - Copyright (c) 2015 The Rust Project Developers
unicode-xid@0.2.6 - MIT OR Apache-2.0 - Copyright (c) 2015 The Rust Project Developers
untrusted@0.9.0 - ISC - Copyright 2015-2016 Brian Smith.
ureq-proto@0.6.4 - MIT OR Apache-2.0 - Copyright 2022 Martin Algesten
ureq@3.4.2 - MIT OR Apache-2.0 - Copyright (c) 2019 Martin Algesten
url@2.5.8 - MIT OR Apache-2.0 - Copyright (c) 2013-2025 The rust-url developers
usvg@0.48.1 - Apache-2.0 OR MIT - Copyright 2017 the Resvg Authors
utf8-zero@0.8.1 - MIT OR Apache-2.0 - authors: Simon Sapin <simon.sapin@exyr.org>, Martin Algesten <martin@algesten.se>
utf8_iter@1.0.4 - Apache-2.0 OR MIT - Copyright Mozilla Foundation
uuid@1.28.0 - Apache-2.0 OR MIT - Copyright (c) 2014 The Rust Project Developers - Copyright (c) 2018 Ashley Mannix, Christopher Armstrong, Dylan DPC, Hunar Roop Kahlon
valuable@0.1.1 - MIT
value-trait@0.12.2 - Apache-2.0/MIT - authors: Heinz N. Gies <heinz@licenser.net>
vfs@0.13.0 - Apache-2.0 - Copyright 2020 Manuel Woelker
vsimd@0.8.0 - MIT
walkdir@2.5.0 - Unlicense/MIT - Copyright (c) 2015 Andrew Gallant
wasi@0.11.1+wasi-snapshot-preview1 - Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT - authors: The Cranelift Project Developers
wasm-bindgen-macro-support@0.2.129 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
wasm-bindgen-macro@0.2.129 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
wasm-bindgen-shared@0.2.129 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
wasm-bindgen@0.2.129 - MIT OR Apache-2.0 - Copyright (c) 2014 Alex Crichton
webpki-root-certs@1.0.9 - CDLA-Permissive-2.0
webpki-roots@1.0.9 - CDLA-Permissive-2.0
weezl@0.1.12 - MIT OR Apache-2.0 - Copyright (c) HeroicKatora 2020
winapi-util@0.1.11 - Unlicense OR MIT - Copyright (c) 2017 Andrew Gallant
windows-collections@0.3.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-core@0.62.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-future@0.3.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-implement@0.60.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-interface@0.59.3 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-link@0.2.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-numerics@0.3.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-result@0.4.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-strings@0.5.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-sys@0.52.0 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-sys@0.60.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-sys@0.61.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-targets@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-targets@0.53.5 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows-threading@0.2.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows@0.62.2 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_aarch64_gnullvm@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_aarch64_gnullvm@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_aarch64_msvc@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_aarch64_msvc@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_gnu@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_gnu@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_gnullvm@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_gnullvm@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_msvc@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_i686_msvc@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_gnu@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_gnu@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_gnullvm@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_gnullvm@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_msvc@0.52.6 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
windows_x86_64_msvc@0.53.1 - MIT OR Apache-2.0 - Copyright (c) Microsoft Corporation.
winnow@0.7.15 - MIT
writeable@0.6.4 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
xattr@1.6.1 - MIT OR Apache-2.0 - Copyright (c) 2015 Steven Allen
xxhash-rust@0.8.19 - BSL-1.0 - authors: Douman <douman@gmx.se>
yaml_parser@0.3.0 - MIT - authors: Pig Fang <g-plane@hotmail.com>
yansi@1.0.1 - MIT OR Apache-2.0 - Copyright 2017 Sergio Benitez - Copyright (c) 2017 Sergio Benitez
yoke-derive@0.8.4 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
yoke@0.8.3 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zerocopy-derive@0.8.62 - BSD-2-Clause OR Apache-2.0 OR MIT - Copyright 2023 The Fuchsia Authors - Copyright 2019 The Fuchsia Authors.
zerocopy@0.8.62 - BSD-2-Clause OR Apache-2.0 OR MIT - Copyright 2023 The Fuchsia Authors - Copyright 2019 The Fuchsia Authors.
zerofrom-derive@0.1.8 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zerofrom@0.1.8 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zeroize@1.9.1 - Apache-2.0 OR MIT - Copyright (c) 2018-2026 The RustCrypto Project Developers
zerotrie@0.2.5 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zerovec-derive@0.11.6 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zerovec@0.11.8 - Unicode-3.0 - COPYRIGHT AND PERMISSION NOTICE - Copyright © 2020-2024 Unicode, Inc.
zip@9.0.1 - MIT - Copyright (c) 2014 Mathijs van de Nes
zlib-rs@0.6.8 - Zlib - (C) 2024 Trifecta Tech Foundation
zmij@1.0.23 - MIT - authors: David Tolnay <dtolnay@gmail.com>
zopfli@0.8.3 - Apache-2.0 - Copyright 2011 Google Inc.
zune-core@0.5.3 - MIT OR Apache-2.0 OR Zlib - Copyright (c) zune-image developers
zune-jpeg@0.5.15 - MIT OR Apache-2.0 OR Zlib - Copyright (c) zune-image developers
```
