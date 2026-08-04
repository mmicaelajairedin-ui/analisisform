/**
 * pw-core-templates.js
 * Core Experience: Templates as Reusable Starting Points
 *
 * Reusable components for template discovery, preview, and population.
 * Used by: panel-v2, multicoach, cliente
 *
 * ⚠️ PURO: Sin dependencias de panel-v2, multicoach o cliente.
 * Las dependencias externas se inyectan vía opciones.
 */

window.PWCoreTemplates = window.PWCoreTemplates || {};

// Helper: escapar HTML
PWCoreTemplates._esc = function(str){
  if(typeof esc === 'function') return esc(str);
  if(!str) return "";
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
};

// Helper: simular plantilla con datos de cliente (safe substitution)
PWCoreTemplates._populateTemplate = function(template, context){
  context = context || {};
  var result = template;

  // Clientes-específicos
  if(context.nombre){
    result = result.replace(/\{\{nombre\}\}/g, PWCoreTemplates._esc(context.nombre));
    result = result.replace(/\{\{nombre_corto\}\}/g, PWCoreTemplates._esc((context.nombre || '').split(' ')[0]));
  }
  if(context.email) result = result.replace(/\{\{email\}\}/g, PWCoreTemplates._esc(context.email));
  if(context.cargo) result = result.replace(/\{\{cargo\}\}/g, PWCoreTemplates._esc(context.cargo));
  if(context.empresa) result = result.replace(/\{\{empresa\}\}/g, PWCoreTemplates._esc(context.empresa));
  if(context.nicho) result = result.replace(/\{\{nicho\}\}/g, PWCoreTemplates._esc(context.nicho));
  if(context.etapa) result = result.replace(/\{\{etapa\}\}/g, PWCoreTemplates._esc(context.etapa));

  // Coach-específicos
  if(context.coach_nombre){
    result = result.replace(/\{\{coach_nombre\}\}/g, PWCoreTemplates._esc(context.coach_nombre));
  }
  if(context.coach_email) result = result.replace(/\{\{coach_email\}\}/g, PWCoreTemplates._esc(context.coach_email));

  // Fecha/hora
  var now = new Date();
  result = result.replace(/\{\{fecha\}\}/g, PWCoreTemplates._esc(now.toLocaleDateString('es-ES')));
  result = result.replace(/\{\{semana\}\}/g, PWCoreTemplates._esc(Math.ceil((now.getDate() - now.getDay() - 1) / 7 + 1)));

  // Generic cleanup: remove unmatched placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
};

// Filter templates by nicho/type/stage
PWCoreTemplates.filterTemplates = function(templates, criteria){
  criteria = criteria || {};
  if(!Array.isArray(templates)) return [];

  return templates.filter(function(t){
    if(criteria.nicho && t.nicho && t.nicho !== criteria.nicho && t.nicho !== 'general') return false;
    if(criteria.type && t.type && t.type !== criteria.type) return false;
    if(criteria.etapa && t.etapa && t.etapa !== criteria.etapa) return false;
    if(criteria.usage && t.usage && t.usage !== criteria.usage) return false;
    return true;
  });
};

// Render template card (preview + CTA)
PWCoreTemplates.renderTemplateCard = function(template, opts){
  opts = opts || {};
  if(!template) return "";

  var _esc = PWCoreTemplates._esc;
  var onUse = opts.onUse; // callback fn, no string
  var size = opts.size || 'normal';
  var compact = size === 'compact';

  var tagHtml = "";
  if(template.tags && Array.isArray(template.tags)){
    tagHtml = "<div style='display:flex;gap:4px;flex-wrap:wrap;margin-top:4px'>";
    template.tags.slice(0, 3).forEach(function(tag){
      tagHtml += "<span style='display:inline-block;padding:2px 8px;background:rgba(45,106,79,.08);border-radius:4px;font-size:10px;color:var(--pw-text-soft)'>"+_esc(tag)+"</span>";
    });
    tagHtml += "</div>";
  }

  var btnHtml = (typeof onUse === 'function')
    ? "<button class='cp-btn cp-btn-primary' style='height:28px;padding:0 12px;font-size:11px;width:100%' onclick='PWCoreTemplates._onUseTemplate()'>Usar plantilla</button>"
    : "<button class='cp-btn cp-btn-primary' style='height:28px;padding:0 12px;font-size:11px;width:100%' disabled>Usar plantilla</button>";

  return "<div class='cp-card' style='background:#fff;border:1px solid var(--pw-border)'>"+
    "<div class='cp-card-pad'>"+
      "<div style='display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:8px'>"+
        "<div style='flex:1;min-width:0'>"+
          "<div style='font-size:"+(compact?'12':'13')+"px;font-weight:600;color:var(--pw-carbon)'>"+_esc(template.titulo||'Plantilla')+"</div>"+
          "<div style='font-size:11px;color:var(--pw-text-soft);margin-top:2px'>"+_esc(template.type||'General')+"</div>"+
        "</div>"+
      "</div>"+
      (template.descripcion ? "<div style='font-size:11px;color:var(--pw-text-soft);line-height:1.4;margin-bottom:8px'>"+_esc(template.descripcion)+"</div>" : "")+
      tagHtml+
      "<div style='margin-top:8px'>"+btnHtml+"</div>"+
    "</div>"+
  "</div>";
};

// Render list of templates with grid/list option
PWCoreTemplates.renderTemplateList = function(templates, opts){
  opts = opts || {};
  if(!Array.isArray(templates) || templates.length === 0) return "";

  var layout = opts.layout || 'list'; // 'list' o 'grid'
  var limit = opts.limit || null;
  var size = opts.size || 'normal';

  var toRender = limit ? templates.slice(0, limit) : templates;
  var gapSize = size === 'compact' ? '6px' : '8px';

  if(layout === 'grid'){
    var html = "<div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:"+gapSize+"'>";
    toRender.forEach(function(t){
      html += PWCoreTemplates.renderTemplateCard(t, {size: size});
    });
    html += "</div>";
    return html;
  } else {
    var html = "<div style='display:flex;flex-direction:column;gap:"+gapSize+"'>";
    toRender.forEach(function(t){
      html += PWCoreTemplates.renderTemplateCard(t, {size: size});
    });
    html += "</div>";
    return html;
  }
};

// Get relevant templates for a client context
PWCoreTemplates.getContextTemplates = function(templates, context){
  context = context || {};
  if(!Array.isArray(templates)) return [];

  return PWCoreTemplates.filterTemplates(templates, {
    nicho: context.nicho,
    type: context.usage, // 'email', 'mensaje', 'meeting', etc
    etapa: context.etapa
  });
};

// Populate template with client context
PWCoreTemplates.populateTemplate = function(template, context){
  return PWCoreTemplates._populateTemplate(template, context);
};

// Get template preview (first 150 chars + ellipsis)
PWCoreTemplates.getTemplatePreview = function(template){
  if(!template || !template.contenido) return "";
  var content = String(template.contenido);
  if(content.length > 150){
    return content.substring(0, 150) + "...";
  }
  return content;
};

// Callback: inyectado por la pantalla
PWCoreTemplates.setUseCallback = function(fn){
  PWCoreTemplates._onUseTemplate = fn;
};
