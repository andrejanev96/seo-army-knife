import { useState, useId } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToolsByCategory } from '../tools/registry';
import { WrenchIcon, ChevronIcon } from './icons';
import './Layout.css';

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
              <WrenchIcon size={18} className="sidebar__icon" />
              <h1 className="sidebar__title">SEO Army Knife</h1>
            </div>
          )}
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <ChevronIcon direction={collapsed ? 'right' : 'left'} size={14} />
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
                      size={16}
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
