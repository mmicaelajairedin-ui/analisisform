/**
 * pw-core-ia.js
 * Core Experience: IA Integration with Zero-Click Context
 *
 * Reusable components for IA prompts, context enrichment, and conversation.
 * Used by: panel-v2, multicoach, cliente
 *
 * ⚠️ PURO: Sin dependencias de panel-v2, multicoach o cliente.
 * Las dependencias externas se inyectan vía opciones.
 * ⚡ FILOSOFIA: IA nunca pregunta por contexto — siempre lo recibe completo.
 */

window.PWCoreIA = window.PWCoreIA || {};

// Helper: escapar para prompt
PWCoreIA._esc = function(str){
  if(!str) return "";
  return String(str)
    .replace(/\\/g,'\\\\')
    .replace(/"/g,'\\"')
    .replace(/\n/g,'\\n');
};

// Helper: build rich context for IA (zero-click)
PWCoreIA.buildContext = function(client, opts){
  opts = opts || {};
  if(!client) return {};

  var context = {
    cliente: {
      id: client.id,
      nombre: client.nombre || "",
      email: client.email || "",
      cargo_actual: client.cargo || "",
      empresa_actual: client.empresa || "",
      foto: client.foto_perfil || client.photo || null
    },
    programa: {
      nicho: (client.raw && client.raw.nicho) || opts.nicho || "carrera",
      etapa_actual: opts.etapaActual || (client.raw && client.raw.etapas && client.raw.etapas[0]) ? client.raw.etapas[0].nombre : "Inicio",
      progreso: opts.progreso || 0,
      etapas_totales: (client.raw && client.raw.etapas) ? client.raw.etapas.length : 4
    },
    sesiones: {
      proxima: (opts.proximaSesion || null),
      completadas: opts.sesionesCompletadas || 0,
      totales: opts.sesiónesTotales || 4
    },
    documentos: {
      cv: opts.tieneCV || false,
      carta: opts.tieneCarta || false,
      linkedin: opts.tieneLinkedIn || false,
      foto: !!client.foto_perfil
    },
    coach: opts.coach || {},
    organizacion: opts.organizacion || {}
  };

  // Add custom fields from opts
  if(opts.custom){
    Object.keys(opts.custom).forEach(function(key){
      context[key] = opts.custom[key];
    });
  }

  return context;
};

// Format context into natural language for prompt injection
PWCoreIA.formatContextForPrompt = function(context){
  if(!context) return "";

  var parts = [];

  if(context.cliente){
    var c = context.cliente;
    parts.push("CLIENTE: "+PWCoreIA._esc(c.nombre)+" ("+PWCoreIA._esc(c.email)+")");
    if(c.cargo_actual) parts.push("  Cargo actual: "+PWCoreIA._esc(c.cargo_actual));
    if(c.empresa_actual) parts.push("  Empresa: "+PWCoreIA._esc(c.empresa_actual));
  }

  if(context.programa){
    var p = context.programa;
    parts.push("PROGRAMA: "+PWCoreIA._esc(p.nicho));
    parts.push("  Etapa actual: "+PWCoreIA._esc(p.etapa_actual));
    parts.push("  Progreso: "+p.progreso+"% ("+p.etapas_totales+" etapas totales)");
  }

  if(context.sesiones){
    var s = context.sesiones;
    parts.push("SESIONES: "+s.completadas+"/"+s.totales+" completadas");
    if(s.proxima) parts.push("  Próxima: "+PWCoreIA._esc(s.proxima));
  }

  if(context.documentos){
    var d = context.documentos;
    var docs = [];
    if(d.cv) docs.push("CV");
    if(d.carta) docs.push("Carta");
    if(d.linkedin) docs.push("LinkedIn");
    if(d.foto) docs.push("Foto");
    parts.push("DOCUMENTOS: "+docs.join(", ")+""+(docs.length===0?" (Ninguno)":""));
  }

  if(context.coach && context.coach.nombre){
    parts.push("COACH: "+PWCoreIA._esc(context.coach.nombre));
  }

  return parts.join("\n");
};

// Build zero-click prompt (IA gets ALL context automatically)
PWCoreIA.buildPrompt = function(userMessage, context, opts){
  opts = opts || {};
  if(!userMessage) return "";

  var systemContext = PWCoreIA.formatContextForPrompt(context);
  var role = opts.role || "asistente"; // 'coach', 'mentor', 'asistente', etc
  var language = opts.language || "es";

  var prompt = "";

  if(systemContext){
    prompt += "CONTEXTO DEL CLIENTE:\n"+systemContext+"\n\n";
  }

  prompt += "INSTRUCCIONES:\n";
  prompt += "- Eres un "+role+" de coaching de carrera profesional.\n";
  prompt += "- Responde en "+language+"\n";
  prompt += "- Usa el contexto anterior para dar respuestas personalizadas y específicas.\n";
  prompt += "- Nunca pidas información que ya está en el contexto.\n";
  prompt += "- Mantén un tono profesional, empático y motivador.\n";

  if(opts.systemPrompt){
    prompt += "\n"+opts.systemPrompt+"\n";
  }

  prompt += "\nMENSAJE DEL CLIENTE:\n"+userMessage;

  return prompt;
};

// Store conversation context (for session continuity)
PWCoreIA.startConversation = function(opts){
  opts = opts || {};
  var convId = "conv_"+Math.random().toString(36).substr(2,9);

  window.PWCoreIA._conversations = window.PWCoreIA._conversations || {};
  window.PWCoreIA._conversations[convId] = {
    id: convId,
    context: opts.context || {},
    messages: [],
    createdAt: new Date().toISOString()
  };

  return convId;
};

// Add message to conversation history
PWCoreIA.addMessage = function(convId, role, content, opts){
  opts = opts || {};
  if(!window.PWCoreIA._conversations || !window.PWCoreIA._conversations[convId]) return null;

  var conv = window.PWCoreIA._conversations[convId];
  conv.messages.push({
    role: role, // 'user' o 'assistant'
    content: content,
    timestamp: new Date().toISOString(),
    metadata: opts.metadata || {}
  });

  return conv.messages.length - 1;
};

// Get conversation history
PWCoreIA.getConversation = function(convId){
  if(!window.PWCoreIA._conversations) return null;
  return window.PWCoreIA._conversations[convId] || null;
};

// Clear conversation
PWCoreIA.clearConversation = function(convId){
  if(window.PWCoreIA._conversations && window.PWCoreIA._conversations[convId]){
    delete window.PWCoreIA._conversations[convId];
  }
};

// Build prompt enriched with conversation history
PWCoreIA.buildPromptWithHistory = function(userMessage, convId, opts){
  opts = opts || {};
  if(!userMessage) return "";

  var conv = PWCoreIA.getConversation(convId);
  if(!conv) return userMessage;

  var prompt = "";

  // Add conversation history as context
  if(conv.messages.length > 0){
    prompt += "HISTORIAL DE CONVERSACION:\n";
    conv.messages.slice(-6).forEach(function(msg){ // last 6 messages for context window
      var prefix = msg.role === 'user' ? "Cliente: " : "Asistente: ";
      prompt += prefix + msg.content + "\n";
    });
    prompt += "\n";
  }

  prompt += "NUEVO MENSAJE DEL CLIENTE:\n" + userMessage;

  return prompt;
};

// Evaluate IA response quality (simple heuristics)
PWCoreIA.evaluateResponse = function(response, context){
  if(!response) return {quality: 'poor', issues: ['Respuesta vacía']};

  var issues = [];

  // Check if IA used context
  if(context && context.cliente && context.cliente.nombre){
    if(response.indexOf(context.cliente.nombre) === -1 &&
       response.toLowerCase().indexOf('cliente') === -1 &&
       response.toLowerCase().indexOf('te') === -1){
      issues.push('No personalizó la respuesta');
    }
  }

  // Check length
  if(response.length < 50) issues.push('Respuesta muy corta');
  if(response.length > 2000) issues.push('Respuesta muy larga');

  // Check for quality markers
  var hasStructure = response.indexOf('\n') !== -1 || response.indexOf('1.') !== -1;
  var hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(response);

  var quality = issues.length === 0 ? 'good' : issues.length <= 1 ? 'fair' : 'poor';

  return {
    quality: quality,
    issues: issues,
    hasStructure: hasStructure,
    hasEmoji: hasEmoji,
    length: response.length
  };
};

// Callback: set external IA handler (for actual API calls)
PWCoreIA.setIAHandler = function(fn){
  PWCoreIA._handleIA = fn;
};

// Call external IA handler with context
PWCoreIA.callIA = function(userMessage, convId, opts){
  opts = opts || {};
  if(typeof PWCoreIA._handleIA !== 'function') return null;

  var conv = PWCoreIA.getConversation(convId);
  if(!conv) return null;

  var prompt = PWCoreIA.buildPromptWithHistory(userMessage, convId, opts);
  return PWCoreIA._handleIA(prompt, conv.context, opts);
};
