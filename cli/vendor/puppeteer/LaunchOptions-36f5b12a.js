// puppeteer-core@24.43.1
import{ChromeReleaseChannel as e}from"@puppeteer/browsers";
/**
* @license
* Copyright 2020 Google Inc.
* SPDX-License-Identifier: Apache-2.0
*/
function t(t){switch(t){case`chrome`:return e.STABLE;case`chrome-dev`:return e.DEV;case`chrome-beta`:return e.BETA;case`chrome-canary`:return e.CANARY}}export{t as convertPuppeteerChannelToBrowsersChannel};