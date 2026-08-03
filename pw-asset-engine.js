/**
 * Asset Engine — Gestiona assets de la organización (logos, favicons, etc.)
 *
 * Responsabilidades:
 * 1. Cargar assets desde Supabase
 * 2. Mantener placeholders/previews
 * 3. Preparar estructura para uploads (Uploadcare)
 * 4. Reutilizable en toda la plataforma
 *
 * NOTA: Uploads con Uploadcare implementar en siguiente iteración
 */

class AssetEngine {
  constructor() {
    this.orgId = null;
    this.assets = {};
    this.listeners = [];
    this.assetTypes = [
      { key: 'logo_dark', label: 'Logo', hint: 'PNG / SVG', category: 'logo' },
      { key: 'logo_light', label: 'Logo Light', hint: 'PNG / SVG', category: 'logo' },
      { key: 'favicon', label: 'Favicon', hint: 'ICO / PNG', category: 'icon' },
      { key: 'og_image', label: 'OG Image', hint: '1200×630px', category: 'social' },
      { key: 'email_logo', label: 'Email Logo', hint: 'PNG', category: 'email' },
      { key: 'pdf_logo', label: 'PDF Logo', hint: 'PNG', category: 'pdf' },
      { key: 'app_icon', label: 'App Icon', hint: 'SVG', category: 'app' },
    ];
  }

  /**
   * Cargar assets desde Supabase
   * @param {string} orgId - ID de la organización
   */
  async loadAssets(orgId) {
    if (!orgId) return null;

    try {
      this.orgId = orgId;

      // Fetch assets actuales (versión v1.0)
      const res = await fetch(
        `/rest/v1/organization_assets?organization_id=eq.${orgId}&version=eq.v1.0&select=*`,
        { headers: this._headers() }
      );

      if (!res.ok) {
        console.warn('[AssetEngine] No assets found, using defaults');
        this.assets = this._getDefaultAssets();
        return this.assets;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach(asset => {
          this.assets[asset.asset_type] = asset;
        });
      }

      console.log('[AssetEngine] ✓ Loaded assets', {
        org: orgId,
        count: Object.keys(this.assets).length,
      });

      return this.assets;
    } catch (err) {
      console.error('[AssetEngine] Error loading assets:', err);
      return this._getDefaultAssets();
    }
  }

  /**
   * Preparar para upload (estructura, sin implementar Uploadcare todavía)
   * @param {string} assetType - 'logo_dark' | 'favicon' | etc
   */
  prepareUpload(assetType) {
    const config = this.assetTypes.find(t => t.key === assetType);
    if (!config) {
      console.warn('[AssetEngine] Unknown asset type:', assetType);
      return null;
    }

    return {
      assetType,
      category: config.category,
      mimeTypes: this._getMimeTypesForCategory(config.category),
      maxSize: this._getMaxSizeForCategory(config.category),
      requiredDimensions: this._getDimensionsForAsset(assetType),
    };
  }

  /**
   * Registrar asset subido (estructura para cuando Uploadcare esté lista)
   * @param {string} assetType - 'logo_dark' | 'favicon' | etc
   * @param {Object} fileData - {url, size, mime_type, dimensions}
   */
  async registerAsset(assetType, fileData) {
    if (!this.orgId || !fileData) return false;

    try {
      // Preparar asset para guardar
      const asset = {
        organization_id: this.orgId,
        version: 'v1.0',
        asset_category: this.assetTypes.find(t => t.key === assetType)?.category,
        asset_type: assetType,
        file_url: fileData.url,
        file_size_bytes: fileData.size,
        mime_type: fileData.mime_type,
        dimensions: fileData.dimensions || {},
        validation_status: 'valid',
        uploadcare_file_id: fileData.uploadcare_id || null,
      };

      // INSERT o UPDATE
      const method = this.assets[assetType] ? 'PATCH' : 'POST';
      const url = method === 'POST'
        ? '/rest/v1/organization_assets'
        : `/rest/v1/organization_assets?organization_id=eq.${this.orgId}&asset_type=eq.${assetType}&version=eq.v1.0`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...this._headers() },
        body: JSON.stringify(asset),
      });

      if (!res.ok) {
        console.error('[AssetEngine] Save failed:', res.status);
        return false;
      }

      this.assets[assetType] = asset;
      this._notifyListeners('asset-registered', { assetType, asset });
      console.log('[AssetEngine] ✓ Registered asset', assetType);
      return true;
    } catch (err) {
      console.error('[AssetEngine] Error registering asset:', err);
      return false;
    }
  }

  /**
   * Obtener asset específico
   * @param {string} assetType - 'logo_dark' | 'favicon' | etc
   */
  getAsset(assetType) {
    return this.assets[assetType] || null;
  }

  /**
   * Obtener URL de asset (o null si no existe)
   * @param {string} assetType - 'logo_dark' | 'favicon' | etc
   */
  getAssetUrl(assetType) {
    const asset = this.getAsset(assetType);
    return asset?.file_url || null;
  }

  /**
   * Obtener lista de todos los asset types con estado
   */
  getAssetTypes() {
    return this.assetTypes.map(config => ({
      ...config,
      uploaded: !!this.assets[config.key],
      url: this.getAssetUrl(config.key),
    }));
  }

  /**
   * Obtener todos los assets
   */
  getAllAssets() {
    return this.assets;
  }

  /**
   * Suscribirse a cambios
   */
  onAssetsUpdated(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _getDefaultAssets() {
    return {
      logo_dark: { asset_type: 'logo_dark', file_url: null, uploaded: false },
      logo_light: { asset_type: 'logo_light', file_url: null, uploaded: false },
      favicon: { asset_type: 'favicon', file_url: null, uploaded: false },
      og_image: { asset_type: 'og_image', file_url: null, uploaded: false },
      email_logo: { asset_type: 'email_logo', file_url: null, uploaded: false },
      pdf_logo: { asset_type: 'pdf_logo', file_url: null, uploaded: false },
      app_icon: { asset_type: 'app_icon', file_url: null, uploaded: false },
    };
  }

  _getMimeTypesForCategory(category) {
    const mimeMap = {
      logo: ['image/png', 'image/svg+xml', 'image/jpeg'],
      icon: ['image/x-icon', 'image/png'],
      social: ['image/png', 'image/jpeg'],
      email: ['image/png', 'image/jpeg'],
      pdf: ['image/png'],
      app: ['image/svg+xml', 'image/png'],
    };
    return mimeMap[category] || ['image/*'];
  }

  _getMaxSizeForCategory(category) {
    // MB
    const sizeMap = {
      logo: 5,
      icon: 2,
      social: 10,
      email: 3,
      pdf: 5,
      app: 2,
    };
    return sizeMap[category] || 5;
  }

  _getDimensionsForAsset(assetType) {
    const dims = {
      og_image: { width: 1200, height: 630 },
      favicon: { width: 64, height: 64 },
      app_icon: { width: 512, height: 512 },
    };
    return dims[assetType] || null;
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[AssetEngine] Listener error:', err);
      }
    });
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      ...(typeof PWAUTH !== 'undefined' ? PWAUTH.headers() : {}),
    };
  }
}

// Instancia global
window.AssetEngine = new AssetEngine();
