import { NavLink, Outlet } from 'react-router-dom';
import { getToolsByCategory } from '../tools/registry';
import './Layout.css';

export default function Layout() {
  const categories = getToolsByCategory();

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="sidebar__title">SEO Army Knife</h1>
        <nav className="sidebar__nav">
          {Array.from(categories.entries()).map(([category, categoryTools]) => (
            <div key={category} className="sidebar__group">
              {category !== '_standalone' && (
                <span className="sidebar__category">{category}</span>
              )}
              {categoryTools.map((tool) => (
                <NavLink
                  key={tool.id}
                  to={`/tool/${tool.id}`}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''} ${category !== '_standalone' ? 'sidebar__link--indented' : ''}`
                  }
                >
                  {tool.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
