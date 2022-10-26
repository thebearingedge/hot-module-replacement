console.log('hello, hmr!')

if (import.meta.hot) {
  import.meta.hot.accept()
}
