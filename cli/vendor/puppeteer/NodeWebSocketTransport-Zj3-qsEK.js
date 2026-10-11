// puppeteer-core@24.43.1
import{t as e}from"./version-B4KjTh00.js";import t from"ws";
/**
* @license
* Copyright 2018 Google Inc.
* SPDX-License-Identifier: Apache-2.0
*/
var n=class n{static create(r,i){return new Promise((a,o)=>{let s=new t(r,[],{followRedirects:!0,perMessageDeflate:!1,allowSynchronousEvents:!1,maxPayload:268435456,headers:{"User-Agent":`Puppeteer ${e}`,...i}});s.addEventListener(`open`,()=>a(new n(s))),s.addEventListener(`error`,o)})}#e;onmessage;onclose;constructor(e){this.#e=e,this.#e.addEventListener(`message`,e=>{this.onmessage&&this.onmessage.call(null,e.data)}),this.#e.addEventListener(`close`,()=>{this.onclose&&this.onclose.call(null)}),this.#e.addEventListener(`error`,()=>{})}send(e){this.#e.send(e)}close(){this.#e.close()}};export{n as NodeWebSocketTransport};