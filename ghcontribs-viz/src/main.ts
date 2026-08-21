import { mountContributionEcosystem, type SizeMode } from './index.ts'
import './demo.css'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <header class="demo-header">
    <p class="demo-eyebrow">GitHub contribution atlas</p>
    <div class="demo-heading-row">
      <div>
        <h1>Repository ecosystem</h1>
        <p class="demo-intro">
          A static map of contribution activity, grouped by repository owner.
          Tile area uses square-root scaling of activity across issues, pull requests,
          reviews, and comments.
        </p>
      </div>
      <fieldset class="demo-size-control">
        <legend>Size repositories by</legend>
        <label>
          <input type="radio" name="size-mode" value="contributions" checked>
          <span>Contributions</span>
        </label>
        <label>
          <input type="radio" name="size-mode" value="equal">
          <span>Equal</span>
        </label>
      </fieldset>
    </div>
  </header>
  <section id="ecosystem" aria-label="Contribution ecosystem"></section>
  <footer class="demo-footer">
    <span>I</span> Issues
    <span>PR</span> Pull requests
    <span>R</span> Reviews
    <span>C</span> Comments
  </footer>
`

const mountElement = document.querySelector<HTMLElement>('#ecosystem')!
const visualization = mountContributionEcosystem(mountElement, {
  dataUrl: import.meta.env.VITE_GHCONTRIBS_DATA_URL ?? '/index.json',
})

document
  .querySelector('.demo-size-control')!
  .addEventListener('change', (event) => {
    const input = event.target
    if (input instanceof HTMLInputElement && input.checked) {
      visualization.setSizeMode(input.value as SizeMode)
    }
  })
