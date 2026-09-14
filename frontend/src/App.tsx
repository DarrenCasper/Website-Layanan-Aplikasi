import { ArrowRight, Boxes, Braces, Palette, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import './App.scss'

type StackItem = {
  icon: LucideIcon
  name: string
  detail: string
}

const stack: StackItem[] = [
  {
    icon: Rocket,
    name: 'Vite 8',
    detail: 'Instant dev server with fast production bundling.',
  },
  {
    icon: Boxes,
    name: 'React 19',
    detail: 'Component model compiled through the SWC transform.',
  },
  {
    icon: Braces,
    name: 'TypeScript',
    detail: 'Strict types across every source file in the app.',
  },
  {
    icon: Palette,
    name: 'SCSS',
    detail: 'Variables, nesting, and partials via Dart Sass.',
  },
]

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <span className="app__badge">
          <Sparkles size={16} aria-hidden="true" />
          Frontend scaffold
        </span>
        <h1 className="app__title">Layanan Aplikasi</h1>
        <p className="app__lead">
          Vite, React with SWC, and TypeScript, styled with SCSS and iconography from lucide.
        </p>
      </header>

      <ul className="stack">
        {stack.map(({ icon: Icon, name, detail }) => (
          <li className="stack__item" key={name}>
            <Icon className="stack__icon" size={24} aria-hidden="true" />
            <h2 className="stack__name">{name}</h2>
            <p className="stack__detail">{detail}</p>
          </li>
        ))}
      </ul>

      <footer className="app__footer">
        <p>
          Start editing <code>src/App.tsx</code>. Hot module replacement keeps this page in sync.
        </p>
        <span className="app__hint">
          <ArrowRight size={16} aria-hidden="true" />
          Ready to build
        </span>
      </footer>
    </main>
  )
}

export default App
