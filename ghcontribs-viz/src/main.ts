import { mountContributionEcosystem } from './index.ts'
import './demo.css'

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <header class="demo-header">
    <p class="demo-eyebrow">GitHub contribution atlas</p>
    <h1>Repository ecosystem</h1>
    <p class="demo-intro">
      An interactive map of contribution activity, grouped by repository owner.
      Tile area uses square-root scaling of activity across issues, pull requests,
      reviews, and comments. Hover or focus a tile for details; use Tab to move,
      Enter or Space to focus an owner or open repository details, and Escape
      to return to the overview.
    </p>
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
mountContributionEcosystem(mountElement, {
  dataUrl: import.meta.env.VITE_GHCONTRIBS_DATA_URL ?? '/index.json',
})
