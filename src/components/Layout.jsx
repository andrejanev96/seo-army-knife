import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getToolsByCategory } from '../tools/registry';
import './Layout.css';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const categories = getToolsByCategory();

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <span className="sidebar__icon">&#9876;</span>
            {!collapsed && <h1 className="sidebar__title">SEO Army Knife</h1>}
          </div>
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        <nav className="sidebar__nav">
          {Array.from(categories.entries()).map(([category, categoryTools]) => (
            <div key={category} className="sidebar__group">
              {category !== '_standalone' && !collapsed && (
                <span className="sidebar__category">{category}</span>
              )}
              {category !== '_standalone' && collapsed && (
                <span className="sidebar__category-dot" title={category}>
                  &#x2022;
                </span>
              )}
              {categoryTools.map((tool) => (
                <NavLink
                  key={tool.id}
                  to={`/tool/${tool.id}`}
                  title={collapsed ? `${tool.category ? tool.category + ': ' : ''}${tool.name}` : undefined}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''} ${category !== '_standalone' ? 'sidebar__link--indented' : ''}`
                  }
                >
                  {collapsed ? tool.name.charAt(0) : tool.name}
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
