// puppeteer-core@25.16.0
import{t as e}from"./Debug-4c8c2df3.js";import{t}from"./version-ae5c6b9a.js";import n from"ws"
/**
* @license
* Copyright 2018 Google Inc.
* SPDX-License-Identifier: Apache-2.0
*/
;var r=class r{static create(e,i,a,o={}){return new Promise((s,c)=>{let l=new n(e,[],{followRedirects:!0,perMessageDeflate:!1,allowSynchronousEvents:!1,maxPayload:o.maxPayload??268435456,handshakeTimeout:o.handshakeTimeout,headers:{"User-Agent":`Puppeteer ${t}`,...i}});l.addEventListener(`open`,()=>s(new r(l,a,o))),l.addEventListener(`error`,c)})}#e;#t;#n;onmessage;onclose;constructor(t,n,r={}){this.#e=t,this.#t=n,this.#e.addEventListener(`message`,e=>{this.onmessage&&this.onmessage.call(null,e.data)}),this.#e.addEventListener(`close`,()=>{this.#i(),this.onclose&&this.onclose.call(null)}),this.#e.addEventListener(`error`,t=>{this.#t?.(e.error)?.(t)}),r.keepAlive&&this.#r(r.keepAliveIntervalMs??3e4)}#r(e){let t=!1;this.#e.on(`pong`,()=>{t=!1}),this.#n=setInterval(()=>{t?this.#e.terminate():(t=!0,this.#e.ping())},e),this.#n.unref?.()}#i(){this.#n!==void 0&&(clearInterval(this.#n),this.#n=void 0)}send(e){this.#e.send(e)}close(){this.#i(),this.#e.close()}};export{r as NodeWebSocketTransport};