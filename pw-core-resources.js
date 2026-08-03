/**
 * pw-core-resources.js
 * Core Experience: Resources as Discoverable Content
 *
 * Reusable components for resource filtering, categorization, and navigation.
 * Used by: panel-v2, multicoach, cliente
 *
 * ⚠️ PURO: Sin dependencias de panel-v2, multicoach o cliente.
 * Las dependencias externas se inyectan vía opciones.
 */

window.PWCoreResources = window.PWCoreResources || {};

// Helper: escapar HTML
PWCoreResources._esc = function(str){
  if(typeof esc === 'function') return esc(str);
  if(!str) return "";
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
};

// Filter resources by nicho/etapa/tags (pure logic)
PWCoreResources.filterResources = function(resources, criteria){
  criteria = criteria || {};
  if(!Array.isArray(resources)) return [];

  return resources.filter(function(r){
    if(criteria.nicho && r.nicho && r.nicho !== criteria.nicho && r.nicho !== 'general') return false;
    if(criteria.etapa && r.etapa && r.etapa !== criteria.etapa) return false;
    if(criteria.tags && Array.isArray(criteria.tags) && r.tags){
      var hasTag = criteria.tags.some(function(t){
        return r.tags.indexOf(t) !== -1;
      });
      if(!hasTag) return false;
    }
    if(criteria.tipo && r.tipo && r.tipo !== criteria.tipo) return false;
    return true;
  });
};

// Group resources by category/week/type
PWCoreResources.groupResources = function(resources, groupBy){
  groupBy = groupBy || 'categoria'; // 'categoria', 'semana', 'tipo', 'etapa'
  if(!Array.isArray(resources)) return {};

  var groups = {};
  resources.forEach(function(r){
    var key = r[groupBy] || 'Sin categoría';
    if(!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return groups;
};

// Sort resources by relevance/date/title
PWCoreResources.sortResources = function(resources, sortBy){
  sortBy = sortBy || 'orden'; // 'orden', 'fecha', 'titulo', 'relevancia'
  if(!Array.isArray(resources)) return [];

  var sorted = resources.slice(); // copy
  sorted.sort(function(a, b){
    if(sortBy === 'titulo'){
      var aTitle = (a.titulo || '').toLowerCase();
      var bTitle = (b.titulo || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    } else if(sortBy === 'fecha'){
      var aDate = new Date(a.fecha || 0).getTime();
      var bDate = new Date(b.fecha || 0).getTime();
      return bDate - aDate;
    } else if(sortBy === 'relevancia'){
      // relevancia = (views * 0.3 + shares * 0.5 + saves * 0.2) + recency boost
      var aRel = ((a.views || 0) * 0.3 + (a.shares || 0) * 0.5 + (a.saves || 0) * 0.2);
      var bRel = ((b.views || 0) * 0.3 + (b.shares || 0) * 0.5 + (b.saves || 0) * 0.2);
      return bRel - aRel;
    } else {
      // default 'orden'
      return (a.orden || 0) - (b.orden || 0);
    }
  });
  return sorted;
};

// Render resource section with header, resources, and metadata
PWCoreResources.renderResourceSection = function(title, resources, opts){
  opts = opts || {};
  if(!Array.isArray(resources) || resources.length === 0) return "";

  var size = opts.size || 'normal';
  var showMeta = opts.showMeta !== false;
  var icon = opts.icon || '📚';
  var _esc = PWCoreResources._esc;

  var html = "<div class='cp-card' style='background:rgba(45,106,79,.02);border:1px solid rgba(45,106,79,.08)'>"+
    "<div class='cp-card-pad'>"+
      "<div style='display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--pw-carbon)'>"+
        "<span>"+icon+"</span>"+_esc(title)+
      "</div>";

  if(showMeta && resources.length > 0){
    html += "<div style='font-size:11px;color:var(--pw-text-soft);margin-bottom:8px'>"+resources.length+" recurso"+(resources.length===1?"":"s")+"</div>";
  }

  html += "<div style='display:flex;flex-direction:column;gap:"+(size==='compact'?'6':'8')+"px'>";
  resources.forEach(function(r){
    // Use PWCoreProgram if available, else inline rendering
    if(typeof PWCoreProgram !== 'undefined' && typeof PWCoreProgram.renderResourceCard === 'function'){
      html += PWCoreProgram.renderResourceCard(r, {size: size});
    } else {
      var tipo = (r.tipo||'artículo').charAt(0).toUpperCase()+(r.tipo||'artículo').slice(1);
      html += "<a href='"+_esc(r.url||'#')+"' target='_blank' rel='noopener' style='display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:#fff;text-decoration:none;color:var(--pw-carbon);transition:background .15s;border:1px solid transparent' onmouseover=\"this.style.background='var(--pw-niebla-2)'\" onmouseout=\"this.style.background='#fff'\">"+
        "<span style='flex:1;min-width:0'>"+
          "<div style='font-size:12px;font-weight:600;color:var(--pw-carbon)'>"+_esc(r.titulo||'Recurso')+"</div>"+
          "<div style='font-size:11px;color:var(--pw-text-soft)'>"+tipo+(r.meta?" · "+_esc(r.meta):"")+"</div>"+
        "</span>→"+
      "</a>";
    }
  });
  html += "</div></div></div>";

  return html;
};

// Render grouped resources (by category/week)
PWCoreResources.renderGroupedResources = function(groupedResources, opts){
  opts = opts || {};
  if(!groupedResources || Object.keys(groupedResources).length === 0) return "";

  var html = "";
  var size = opts.size || 'normal';

  Object.keys(groupedResources).forEach(function(groupName){
    html += PWCoreResources.renderResourceSection(groupName, groupedResources[groupName], {
      size: size,
      showMeta: opts.showMeta !== false
    });
  });

  return html;
};

// Get resources for a specific stage (etapa)
PWCoreResources.getStageResources = function(resources, stage){
  if(!stage || !Array.isArray(resources)) return [];

  return PWCoreResources.filterResources(resources, {
    etapa: stage
  });
};

// Get onboarding resources (first stage only)
PWCoreResources.getOnboardingResources = function(resources){
  if(!Array.isArray(resources)) return [];

  return resources.filter(function(r){
    return r.stage === 'onboarding' || r.etapa === '1' || r.onboarding === true;
  });
};
