// services/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Cambia esta URL cuando tengas tu backend desplegado
const API_URL = __DEV__ 
  ? 'http://localhost:3000/api' 
  : 'https://tu-backend-en-render.com/api';

class StorageService {
  constructor() {
    this.usuarioId = null;
    this.inicializar();
  }

  async inicializar() {
    // Obtener o crear ID de usuario único
    let userId = await AsyncStorage.getItem('usuario_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('usuario_id', userId);
    }
    this.usuarioId = userId;
  }

  // ========== OPERACIONES LOCALES ==========

  async guardarLocal(fecha, burbujas, conexiones) {
    const key = `emociones_${fecha}`;
    const datos = { burbujas, conexiones, fecha, synced: false };
    await AsyncStorage.setItem(key, JSON.stringify(datos));
    
    // Añadir a cola de sincronización
    await this.añadirAColaSinc(key);
  }

  async obtenerLocal(fecha) {
    const key = `emociones_${fecha}`;
    const datos = await AsyncStorage.getItem(key);
    return datos ? JSON.parse(datos) : null;
  }

  async añadirAColaSinc(key) {
    let cola = await AsyncStorage.getItem('cola_sinc');
    cola = cola ? JSON.parse(cola) : [];
    if (!cola.includes(key)) {
      cola.push(key);
      await AsyncStorage.setItem('cola_sinc', JSON.stringify(cola));
    }
  }

  // ========== SINCRONIZACIÓN CON BACKEND ==========

  async sincronizar() {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Sin conexión, sincronización pospuesta');
      return false;
    }

    try {
      let cola = await AsyncStorage.getItem('cola_sinc');
      cola = cola ? JSON.parse(cola) : [];

      for (const key of cola) {
        const datos = await AsyncStorage.getItem(key);
        if (datos) {
          const datosParseados = JSON.parse(datos);
          
          await axios.post(`${API_URL}/emociones`, {
            usuario_id: this.usuarioId,
            fecha: datosParseados.fecha,
            burbujas: datosParseados.burbujas,
            conexiones: datosParseados.conexiones
          });

          // Marcar como sincronizado
          datosParseados.synced = true;
          await AsyncStorage.setItem(key, JSON.stringify(datosParseados));
        }
      }

      // Limpiar cola
      await AsyncStorage.setItem('cola_sinc', JSON.stringify([]));
      console.log('✅ Sincronización completada');
      return true;
    } catch (error) {
      console.error('Error en sincronización:', error);
      return false;
    }
  }

  // ========== OPERACIONES CON BACKEND ==========

  async obtenerDelServidor(fecha) {
    try {
      const response = await axios.get(
        `${API_URL}/emociones/${this.usuarioId}/${fecha}`
      );
      return response.data;
    } catch (error) {
      console.error('Error obteniendo del servidor:', error);
      return null;
    }
  }

  async obtenerHistorial(dias = 30) {
    try {
      const response = await axios.get(
        `${API_URL}/emociones/historial/${this.usuarioId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }

  async obtenerEstadisticas(dias = 7) {
    try {
      const response = await axios.get(
        `${API_URL}/estadisticas/${this.usuarioId}?dias=${dias}`
      );
      return response.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  async exportarDatos() {
    try {
      const response = await axios.get(
        `${API_URL}/exportar/${this.usuarioId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error exportando datos:', error);
      return null;
    }
  }

  // ========== ESTRATEGIA HÍBRIDA ==========

  async guardar(fecha, burbujas, conexiones) {
    // 1. Guardar local primero (siempre)
    await this.guardarLocal(fecha, burbujas, conexiones);

    // 2. Intentar sincronizar si hay internet
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      await this.sincronizar();
    }
  }

  async obtener(fecha) {
    // 1. Intentar obtener del servidor primero
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      const datosServidor = await this.obtenerDelServidor(fecha);
      if (datosServidor && datosServidor.burbujas) {
        // Guardar en caché local
        await this.guardarLocal(fecha, datosServidor.burbujas, datosServidor.conexiones);
        return datosServidor;
      }
    }

    // 2. Si no hay internet o no hay datos en servidor, usar local
    return await this.obtenerLocal(fecha);
  }

  // ========== UTILIDADES ==========

  async limpiarCache() {
    const keys = await AsyncStorage.getAllKeys();
    const emocionKeys = keys.filter(key => key.startsWith('emociones_'));
    await AsyncStorage.multiRemove(emocionKeys);
  }

  async obtenerEstadoSincronizacion() {
    const cola = await AsyncStorage.getItem('cola_sinc');
    const pendientes = cola ? JSON.parse(cola).length : 0;
    return {
      pendientes,
      sincronizado: pendientes === 0
    };
  }
}

export default new StorageService();