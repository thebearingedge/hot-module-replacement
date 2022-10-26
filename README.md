# hot-module-replacement

I'm learning about how HMR actually works.

### References

- [ESM HMR Spec](https://github.com/FredKSchott/esm-hmr) by Snowpack guy Fred Schott
- Vite implementation
  - [client](https://github.com/vitejs/vite/blob/main/packages/vite/src/client/client.ts)
  - [server](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/hmr.ts)
- modern-web.dev implementation
  - [client](https://github.com/modernweb-dev/web/blob/master/packages/dev-server-hmr/scripts/hmrClientScript.js)
  - [server](https://github.com/modernweb-dev/web/blob/master/packages/dev-server-hmr/src/HmrPlugin.ts)
