const $h1 = document.createElement('h1')
$h1.textContent = 'Hot Module Replacement!'
document.body.append($h1)

if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => $h1.remove())
}
