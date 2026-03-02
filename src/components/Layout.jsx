import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToolsByCategory } from '../tools/registry';
import './Layout.css';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const categories = getToolsByCategory();
  const location = useLocation();

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  // Check if any child tool in a category is currently active
  const isCategoryActive = (categoryTools) =>
    categoryTools.some((tool) => location.pathname === `/tool/${tool.id}`);

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__header">
          {!collapsed && (
            <div className="sidebar__brand">
              <span className="sidebar__icon">&#9876;</span>
              <h1 className="sidebar__title">SEO Army Knife</h1>
            </div>
          )}
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        {!collapsed && (
          <nav className="sidebar__nav">
            {Array.from(categories.entries()).map(([category, categoryTools]) => {
              // Standalone tools render as a single link
              if (category === '_standalone') {
                return categoryTools.map((tool) => (
                  <NavLink
                    key={tool.id}
                    to={`/tool/${tool.id}`}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                    }
                  >
                    {tool.name}
                  </NavLink>
                ));
              }

              // Grouped tools render as expandable category
              const isActive = isCategoryActive(categoryTools);
              const isExpanded = expandedCategories[category] || isActive;

              return (
                <div key={category} className="sidebar__group">
                  <button
                    className={`sidebar__link sidebar__category-btn ${isActive ? 'sidebar__category-btn--active' : ''}`}
                    onClick={() => toggleCategory(category)}
                  >
                    <span>{category}</span>
                    <span className={`sidebar__chevron ${isExpanded ? 'sidebar__chevron--open' : ''}`}>
                      {'\u25B8'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="sidebar__children">
                      {categoryTools.map((tool) => (
                        <NavLink
                          key={tool.id}
                          to={`/tool/${tool.id}`}
                          className={({ isActive: toolActive }) =>
                            `sidebar__link sidebar__link--child ${toolActive ? 'sidebar__link--active' : ''}`
                          }
                        >
                          {tool.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
