import { useState, useId } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToolsByCategory } from '../tools/registry';
import './Layout.css';

function WrenchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronIcon({ direction = 'right', ...props }) {
  const rotations = { right: 0, left: 180, down: 90, up: -90 };
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: `rotate(${rotations[direction]}deg)` }} {...props}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const categories = getToolsByCategory();
  const location = useLocation();
  const idPrefix = useId();

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const isCategoryActive = (categoryTools) =>
    categoryTools.some((tool) => location.pathname === `/tool/${tool.id}`);

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Tool navigation">
        <div className="sidebar__header">
          {!collapsed && (
            <div className="sidebar__brand">
              <WrenchIcon className="sidebar__icon" width="18" height="18" />
              <h1 className="sidebar__title">SEO Army Knife</h1>
            </div>
          )}
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <ChevronIcon direction={collapsed ? 'right' : 'left'} width="14" height="14" />
          </button>
        </div>

        {!collapsed && (
          <nav className="sidebar__nav">
            {Array.from(categories.entries()).map(([category, categoryTools]) => {
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

              const isActive = isCategoryActive(categoryTools);
              const isExpanded = expandedCategories[category] || isActive;
              const panelId = `${idPrefix}-cat-${category}`;

              return (
                <div key={category} className="sidebar__group">
                  <button
                    className={`sidebar__link sidebar__category-btn ${isActive ? 'sidebar__category-btn--active' : ''}`}
                    onClick={() => toggleCategory(category)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                  >
                    <span>{category}</span>
                    <ChevronIcon
                      direction={isExpanded ? 'down' : 'right'}
                      width="16"
                      height="16"
                      className="sidebar__chevron"
                    />
                  </button>
                  {isExpanded && (
                    <div className="sidebar__children" id={panelId}>
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
