/* MultiCoach Reusable Components */

// Modal management
const Modal = {
  open(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },
  close(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  },
  toggle(id) {
    const modal = document.getElementById(id);
    if (modal && modal.classList.contains('active')) {
      this.close(id);
    } else {
      this.open(id);
    }
  }
};

// Drawer management
const Drawer = {
  open(id) {
    const drawer = document.getElementById(id);
    if (drawer) {
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },
  close(id) {
    const drawer = document.getElementById(id);
    if (drawer) {
      drawer.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  },
  toggle(id) {
    const drawer = document.getElementById(id);
    if (drawer && drawer.classList.contains('active')) {
      this.close(id);
    } else {
      this.open(id);
    }
  }
};

// Tab management
const Tabs = {
  activate(tabId, contentId) {
    // Deactivate all tabs and hide all content in the same group
    const tabsContainer = document.querySelector(`[data-tabs-group="${contentId}"]`);
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      tabsContainer.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
    }

    // Activate current tab and show current content
    const tab = document.getElementById(tabId);
    const content = document.getElementById(contentId);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
  }
};

// Toast notifications
const Toast = {
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = 'var(--space-lg)';
    toast.style.right = 'var(--space-lg)';
    toast.style.zIndex = '3000';
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  },
  success(message) {
    this.show(message, 'success');
  },
  error(message) {
    this.show(message, 'error');
  },
  info(message) {
    this.show(message, 'info');
  }
};

// Loading state management
const Loading = {
  show(element) {
    if (element) {
      element.classList.add('loading');
      element.style.pointerEvents = 'none';
    }
  },
  hide(element) {
    if (element) {
      element.classList.remove('loading');
      element.style.pointerEvents = 'auto';
    }
  },
  isActive(element) {
    return element && element.classList.contains('loading');
  }
};

// Table rendering helper
const Table = {
  render(data, columns, options = {}) {
    let html = '<table class="data-table">';

    // Header
    html += '<thead><tr>';
    columns.forEach(col => {
      html += `<th>${escapeHtml(col.label)}</th>`;
    });
    if (options.actions) {
      html += '<th>Acciones</th>';
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    if (data.length === 0) {
      html += `<tr><td colspan="${columns.length + (options.actions ? 1 : 0)}" class="text-center text-muted">No hay datos</td></tr>`;
    } else {
      data.forEach((row, idx) => {
        html += '<tr>';
        columns.forEach(col => {
          const value = row[col.key];
          if (col.render) {
            html += `<td>${col.render(value, row, idx)}</td>`;
          } else {
            html += `<td>${escapeHtml(String(value || ''))}</td>`;
          }
        });
        if (options.actions) {
          html += '<td class="text-right">';
          options.actions.forEach(action => {
            html += `<button class="btn btn-sm btn-ghost" onclick="${action.onClick}(${escapeHtml(JSON.stringify(row.id))})">${action.label}</button>`;
          });
          html += '</td>';
        }
        html += '</tr>';
      });
    }
    html += '</tbody></table>';

    return html;
  }
};

// Card rendering helper
const Card = {
  render(data, template) {
    if (!Array.isArray(data)) {
      data = [data];
    }

    let html = '<div class="grid-container">';
    data.forEach((item, idx) => {
      html += `<div class="card" onclick="if(this.dataset.onClick) eval(this.dataset.onClick)"${item.id ? ` data-id="${item.id}"` : ''}>`;
      if (template) {
        html += template(item, idx);
      }
      html += '</div>';
    });
    html += '</div>';

    return html;
  }
};

// Sidebar navigation
const Sidebar = {
  init() {
    const links = document.querySelectorAll('.sidebar-nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const page = link.dataset.page;
        if (page) {
          navigateTo(page);
        }
      });
    });

    // Set active based on current page
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  },

  toggleMobile() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  },

  closeMobile() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove('active');
    }
  }
};

// Header search
const Search = {
  init(onSearch) {
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        if (onSearch) onSearch(term);
      });
    }
  },

  getValue() {
    const searchInput = document.querySelector('.header-search input');
    return searchInput ? searchInput.value : '';
  },

  setValue(value) {
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
      searchInput.value = value;
    }
  },

  clear() {
    this.setValue('');
  }
};

// Filter controls
const Filter = {
  init(onFilterChange) {
    const selects = document.querySelectorAll('.page-controls select, .page-controls input');
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        if (onFilterChange) {
          const filters = this.getFilters();
          onFilterChange(filters);
        }
      });
    });
  },

  getFilters() {
    const filters = {};
    const inputs = document.querySelectorAll('.page-controls input, .page-controls select');
    inputs.forEach(input => {
      if (input.name && input.value) {
        filters[input.name] = input.value;
      }
    });
    return filters;
  },

  setFilter(name, value) {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) {
      input.value = value;
    }
  },

  reset() {
    document.querySelectorAll('.page-controls input, .page-controls select').forEach(input => {
      input.value = '';
    });
  }
};

// Pagination
const Pagination = {
  render(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="Pagination.goToPage(${currentPage - 1}, ${totalPages})">← Anterior</button>`;

    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      if (i > 1 && i < currentPage - 2) html += '<span>...</span>';
      html += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="Pagination.goToPage(${i}, ${totalPages})">${i}</button>`;
      if (i < totalPages && i > currentPage + 2) html += '<span>...</span>';
    }

    html += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="Pagination.goToPage(${currentPage + 1}, ${totalPages})">Siguiente →</button>`;
    html += '</div>';

    return html;
  },

  goToPage(page, totalPages) {
    if (page < 1 || page > totalPages) return;
    // Store in sessionStorage and reload
    sessionStorage.setItem('currentPage', page);
    window.location.reload();
  }
};

// Confirmation dialog
const Confirm = {
  show(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirmar</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer" style="display:flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg);">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); if(window.lastCancel) window.lastCancel()">Cancelar</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove(); if(window.lastConfirm) window.lastConfirm()">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    window.lastConfirm = onConfirm;
    window.lastCancel = onCancel;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
};

// Utility to render badge
function renderBadge(status, text) {
  const badgeClass = getStatusClass(status);
  return `<span class="badge ${badgeClass}">${escapeHtml(text)}</span>`;
}

// Utility to render status indicator
function renderStatus(status) {
  const statusMap = {
    'active': { label: 'Activo', class: 'status-active' },
    'inactive': { label: 'Inactivo', class: 'status-inactive' },
    'pending': { label: 'Pendiente', class: 'status-pending' },
    'completed': { label: 'Completado', class: 'status-active' }
  };
  const info = statusMap[status] || { label: status, class: 'status-inactive' };
  return `<span class="status ${info.class}"><span class="status-dot"></span>${info.label}</span>`;
}

// Initialize all components on page load
document.addEventListener('DOMContentLoaded', () => {
  Sidebar.init();
});
