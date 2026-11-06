// puppeteer-core@25.16.0
/**
* @license
* Copyright 2020 Google Inc.
* SPDX-License-Identifier: Apache-2.0
*/
const e=!!(typeof process<`u`&&process.version),t={value:{followSymlinks:!0,ScreenRecorder:class{constructor(){throw Error(`ScreenRecorder is not available in this environment`)}},readFile:(()=>{throw Error(`readFile is not available in this environment`)}),writeFile:()=>{throw Error(`writeFile is not available in this environment`)},openFileForWriting:()=>{throw Error(`openFileForWriting is not available in this environment`)},createWriteStream:()=>{throw Error(`createWriteStream is not available in this environment`)},mkdir:()=>{throw Error(`mkdir is not available in this environment`)}}},n={cdpSend:`puppeteer:protocol:SEND ►`,cdpReceive:`puppeteer:protocol:RECV ◀`,bidiSend:`puppeteer:webDriverBiDi:SEND ►`,bidiReceive:`puppeteer:webDriverBiDi:RECV ◀`,error:`puppeteer:error`,ffmpeg:`puppeteer:ffmpeg`},r=n=>{
/**
* @license
* Copyright 2020 Google Inc.
* SPDX-License-Identifier: Apache-2.0
*/
if(e){let e=t.value.debuglog?.(n);return!e||!e.enabled?void 0:(...t)=>{e(...t)}}let r=globalThis.__PUPPETEER_DEBUG;if(r&&(r===`*`||(r.endsWith(`*`)?n.startsWith(r.slice(0,-1)):n===r)))return(...e)=>{console.log(`${n}:`,...e)}};export{e as i,r as n,t as r,n as t};