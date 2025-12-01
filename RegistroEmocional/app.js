// App.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import storageService from './services/storage';

const { width, height } = Dimensions.get('window');

export default function App() {
  const [burbujas, setBurbujas] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [burbujaSeleccionada, setBurbujaSeleccionada] = useState(null);
  const [modoConexion, setModoConexion] = useState(false);
  const [conexionOrigen, setConexionOrigen] = useState(null);
  const [editandoNota, setEditandoNota] = useState(null);
  const [notaActual, setNotaActual] = useState('');
  const [estadoSync, setEstadoSync] = useState({ sincronizado: true });

  const emocionesDisponibles = [
    { nombre: 'Alegría', color: '#FFD700' },
    { nombre: 'Tristeza', color: '#4169E1' },
    { nombre: 'Enfado', color: '#DC143C' },
    { nombre: 'Miedo', color: '#9370DB' },
    { nombre: 'Calma', color: '#98FB98' },
    { nombre: 'Amor', color: '#FF69B4' },
    { nombre: 'Ansiedad', color: '#FF6347' },
    { nombre: 'Sorpresa', color: '#FFA500' },
    { nombre: 'Vergüenza', color: '#DDA0DD' },
    { nombre: 'Frustración', color: '#8B0000' },
  ];

  // Cargar datos al iniciar
  useEffect(() => {
    cargarDatos();
    verificarSync();
    
    // Sincronizar cada 30 segundos
    const interval = setInterval(() => {
      storageService.sincronizar();
      verificarSync();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const datos = await storageService.obtener(hoy);
    
    if (datos) {
      setBurbujas(datos.burbujas || []);
      setConexiones(datos.conexiones || []);
    }
  };

  const verificarSync = async () => {
    const estado = await storageService.obtenerEstadoSincronizacion();
    setEstadoSync(estado);
  };

  const guardarDatos = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    await storageService.guardar(hoy, burbujas, conexiones);
    verificarSync();
  };

  useEffect(() => {
    if (burbujas.length > 0 || conexiones.length > 0) {
      guardarDatos();
    }
  }, [burbujas, conexiones]);

  const añadirEmocion = (emocion, posicion = null) => {
    const existente = burbujas.find(b => b.nombre === emocion.nombre);
    
    if (existente) {
      setBurbujas(burbujas.map(b => 
        b.id === existente.id 
          ? { 
              ...b, 
              count: b.count + 1,
              registros: [...b.registros, { timestamp: new Date().toISOString() }]
            }
          : b
      ));
    } else {
      const nuevaBurbuja = {
        id: Date.now(),
        nombre: emocion.nombre,
        color: emocion.color,
        count: 1,
        x: posicion?.x || Math.random() * 60 + 20,
        y: posicion?.y || Math.random() * 60 + 20,
        registros: [{ timestamp: new Date().toISOString(), nota: '' }]
      };
      setBurbujas([...burbujas, nuevaBurbuja]);
    }
    setMostrarSelector(false);
  };

  const handleClickBurbuja = (burbuja) => {
    if (modoConexion) {
      if (!conexionOrigen) {
        setConexionOrigen(burbuja);
      } else if (conexionOrigen.id !== burbuja.id) {
        const nuevaConexion = {
          id: Date.now(),
          origen: conexionOrigen.id,
          destino: burbuja.id
        };
        setConexiones([...conexiones, nuevaConexion]);
        setConexionOrigen(null);
        setModoConexion(false);
      }
    } else {
      añadirEmocion({ nombre: burbuja.nombre, color: burbuja.color });
    }
  };

  const eliminarBurbuja = (id) => {
    setBurbujas(burbujas.filter(b => b.id !== id));
    setConexiones(conexiones.filter(c => c.origen !== id && c.destino !== id));
    setBurbujaSeleccionada(null);
  };

  const añadirNotaARegistro = (burbujaId, registroIndex, nota) => {
    setBurbujas(burbujas.map(b => {
      if (b.id === burbujaId) {
        const nuevosRegistros = [...b.registros];
        nuevosRegistros[registroIndex] = { ...nuevosRegistros[registroIndex], nota };
        return { ...b, registros: nuevosRegistros };
      }
      return b;
    }));
    setEditandoNota(null);
    setNotaActual('');
  };

  const calcularTamaño = (count) => {
    return Math.min(60 + count * 15, 150);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Mapa Emocional</Text>
        <View style={styles.headerButtons}>
          {!estadoSync.sincronizado && (
            <Text style={styles.syncText}>⚠️ {estadoSync.pendientes} pendientes</Text>
          )}
          <TouchableOpacity
            style={[styles.button, modoConexion && styles.buttonActive]}
            onPress={() => setModoConexion(!modoConexion)}
          >
            <Text style={styles.buttonText}>
              {modoConexion ? '❌ Cancelar' : '🔗 Conectar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lienzo */}
      <TouchableOpacity
        style={styles.canvas}
        onPress={() => setMostrarSelector(true)}
        activeOpacity={1}
      >
        {burbujas.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>➕</Text>
            <Text style={styles.emptySubtext}>Toca para añadir tu primera emoción</Text>
          </View>
        )}

        {/* SVG para conexiones */}
        <Svg height={height} width={width} style={styles.svg}>
          {conexiones.map(conexion => {
            const origen = burbujas.find(b => b.id === conexion.origen);
            const destino = burbujas.find(b => b.id === conexion.destino);
            if (!origen || !destino) return null;
            
            return (
              <Line
                key={conexion.id}
                x1={`${origen.x}%`}
                y1={`${origen.y}%`}
                x2={`${destino.x}%`}
                y2={`${destino.y}%`}
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            );
          })}
        </Svg>

        {/* Burbujas */}
        {burbujas.map(burbuja => {
          const tamaño = calcularTamaño(burbuja.count);
          const esOrigen = conexionOrigen?.id === burbuja.id;
          
          return (
            <TouchableOpacity
              key={burbuja.id}
              style={[
                styles.burbuja,
                {
                  left: `${burbuja.x}%`,
                  top: `${burbuja.y}%`,
                  width: tamaño,
                  height: tamaño,
                  backgroundColor: burbuja.color,
                  opacity: esOrigen ? 1 : 0.85,
                  borderWidth: esOrigen ? 4 : 0,
                  borderColor: 'white'
                }
              ]}
              onPress={() => handleClickBurbuja(burbuja)}
              onLongPress={() => setBurbujaSeleccionada(burbuja)}
            >
              <Text style={styles.burbujaCount}>{burbuja.count}</Text>
              <Text style={styles.burbujaNombre}>{burbuja.nombre}</Text>
            </TouchableOpacity>
          );
        })}
      </TouchableOpacity>

      {/* Modal Selector de Emociones */}
      <Modal visible={mostrarSelector} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMostrarSelector(false)}
          activeOpacity={1}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Qué sientes?</Text>
            <View style={styles.emocionesGrid}>
              {emocionesDisponibles.map((emocion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.emocionButton, { backgroundColor: emocion.color }]}
                  onPress={() => añadirEmocion(emocion)}
                >
                  <Text style={styles.emocionText}>{emocion.nombre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Detalle de Burbuja */}
      <Modal visible={burbujaSeleccionada !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detalleModal}>
            <Text style={styles.detalleTitulo}>
              {burbujaSeleccionada?.nombre}
            </Text>
            <Text style={styles.detalleSubtitulo}>
              Registrada {burbujaSeleccionada?.count} {burbujaSeleccionada?.count === 1 ? 'vez' : 'veces'} hoy
            </Text>

            <ScrollView style={styles.registrosScroll}>
              {burbujaSeleccionada?.registros.map((registro, index) => (
                <View key={index} style={styles.registroItem}>
                  <Text style={styles.registroHora}>
                    {new Date(registro.timestamp).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                  
                  {editandoNota === index ? (
                    <View>
                      <TextInput
                        value={notaActual}
                        onChangeText={setNotaActual}
                        placeholder="¿Qué desencadenó esta emoción?"
                        style={styles.notaInput}
                        multiline
                      />
                      <View style={styles.notaButtons}>
                        <TouchableOpacity
                          style={styles.notaSaveButton}
                          onPress={() => añadirNotaARegistro(burbujaSeleccionada.id, index, notaActual)}
                        >
                          <Text style={styles.notaButtonText}>Guardar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.notaCancelButton}
                          onPress={() => {
                            setEditandoNota(null);
                            setNotaActual('');
                          }}
                        >
                          <Text style={styles.notaButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View>
                      {registro.nota ? (
                        <Text style={styles.notaTexto}>"{registro.nota}"</Text>
                      ) : (
                        <Text style={styles.sinNota}>Sin notas</Text>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setEditandoNota(index);
                          setNotaActual(registro.nota || '');
                        }}
                      >
                        <Text style={styles.editarNota}>
                          {registro.nota ? 'Editar nota' : 'Añadir nota'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.eliminarButton}
              onPress={() => {
                Alert.alert(
                  'Eliminar emoción',
                  '¿Estás seguro?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', onPress: () => eliminarBurbuja(burbujaSeleccionada.id), style: 'destructive' }
                  ]
                );
              }}
            >
              <Text style={styles.eliminarText}>🗑️ Eliminar esta emoción</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cerrarButton}
              onPress={() => setBurbujaSeleccionada(null)}
            >
              <Text style={styles.cerrarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  syncText: {
    fontSize: 12,
    color: '#FF6347'
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  },
  buttonActive: {
    backgroundColor: '#9370DB'
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  canvas: {
    flex: 1,
    position: 'relative'
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -50 }],
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 48,
    opacity: 0.3
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center'
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0
  },
  burbuja: {
    position: 'absolute',
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  burbujaCount: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  burbujaNombre: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center'
  },
  emocionesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  emocionButton: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  emocionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  },
  detalleModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0
  },
  detalleTitulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5
  },
  detalleSubtitulo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15
  },
  registrosScroll: {
    maxHeight: 300
  },
  registroItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10
  },
  registroHora: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8
  },
  notaInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 10
  },
  notaButtons: {
    flexDirection: 'row',
    gap: 10
  },
  notaSaveButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
    flex: 1
  },
  notaCancelButton: {
    backgroundColor: '#999',
    padding: 8,
    borderRadius: 6,
    flex: 1
  },
  notaButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600'
  },
  notaTexto: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8
  },
  sinNota: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8
  },
  editarNota: {
    fontSize: 12,
    color: '#2196F3'
  },
  eliminarButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 10
  },
  eliminarText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16
  },
  cerrarButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10
  },
  cerrarText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16
  }
});