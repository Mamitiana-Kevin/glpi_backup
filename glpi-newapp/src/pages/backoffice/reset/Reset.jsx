import { useMemo, useState } from 'react'
import { allAPI, purgeAll } from '../../../services/resetService'

export default function Reset() {
  const [selected, setSelected] = useState(() => allAPI.map((entity) => entity.url))
  const [isResetting, setIsResetting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tracking, setTracking] = useState([])
  const [completedCount, setCompletedCount] = useState(0)

  const selectedCount = selected.length
  const totalCount = allAPI.length
  const isAllSelected = selectedCount === totalCount

  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return 'Aucune entité sélectionnée'
    if (selectedCount === totalCount) return 'Toutes les entités sont sélectionnées'
    return `${selectedCount} entité(s) sélectionnée(s)`
  }, [selectedCount, totalCount])

  const toggleEntity = (entityName) => {
    setSelected((current) =>
      current.includes(entityName)
        ? current.filter((item) => item !== entityName)
        : [...current, entityName]
    )
    setMessage('')
    setError('')
  }

  const toggleAll = () => {
    setSelected(isAllSelected ? [] : allAPI.map((entity) => entity.url))
    setMessage('')
    setError('')
  }

  const handleReset = async () => {
    if (selected.length === 0) {
      setError('Sélectionne au moins une case avant de lancer la purge.')
      return
    }
    try {
      setIsResetting(true)
      setError('')
      setMessage('')
      setCompletedCount(0)
      setTracking(
        selected.map((entity) => ({
          entity,
          status: 'pending',
          total: 0,
          successCount: 0,
          failureCount: 0,
        }))
      )

      const results = await purgeAll(selected, ({ entity, status, total, successCount, failureCount }) => {
        setTracking((current) =>
          current.map((item) =>
            item.entity === entity
              ? {
                  ...item,
                  status,
                  total: total ?? item.total,
                  successCount: successCount ?? item.successCount,
                  failureCount: failureCount ?? item.failureCount,
                }
              : item
          )
        )
        if (status === 'success' || status === 'warning' || status === 'error') {
          setCompletedCount((current) => Math.min(current + 1, selected.length))
        }
      })

      const successCount = results.filter((r) => r.success).length
      const failureCount = results.length - successCount

      if (failureCount > 0) {
        setMessage(`Purge terminée avec ${successCount} suppression(s) réussie(s) et ${failureCount} erreur(s).`)
      } else {
        setMessage(`Purge terminée : ${successCount} suppression(s) réussie(s).`)
      }
    } catch {
      setError('Impossible de lancer la purge.')
    } finally {
      setIsResetting(false)
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'success': return 'OK'
      case 'warning': return 'Partiel'
      case 'error': return 'Erreur'
      case 'running': return 'En cours'
      default: return 'En attente'
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'status-5'
      case 'warning': return 'status-4'
      case 'error': return 'status-6'
      case 'running': return 'status-2'
      default: return 'status-1'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Reset des données</h2>
        <p>Coche les entités à purger, puis lance le reset uniquement sur celles sélectionnées.</p>
        <small className="text-muted">{selectedLabel}</small>
      </div>

      {/* Grille des checkboxes */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {allAPI.map((entity) => (
          <label
            key={entity.url}
            className="glpi-card"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              cursor: 'pointer',
              borderColor: selected.includes(entity.url) ? 'var(--primary-color)' : 'var(--border-color)',
              background: selected.includes(entity.url) ? '#eff6ff' : '#fff',
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(entity.url)}
              onChange={() => toggleEntity(entity.url)}
              className="form-control"
              style={{ width: '18px', height: '18px', padding: 0 }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{entity.url}</span>
          </label>
        ))}
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={toggleAll}
          disabled={isResetting}
          className="btn btn-outline"
        >
          {isAllSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>

        <button
          onClick={handleReset}
          disabled={isResetting || selected.length === 0}
          className="btn btn-danger"
        >
          {isResetting ? 'Purge en cours...' : 'Lancer le reset'}
        </button>
      </div>

      {/* Suivi */}
      {tracking.length > 0 && (
        <div className="glpi-card" style={{ padding: '0', overflow: 'hidden', background: '#f8fafc' }}>
          <div className="panel-header" style={{ background: 'transparent' }}>
            <h3>Progression ({completedCount}/{selected.length})</h3>
          </div>
          <div className="table-wrapper">
            <table className="glpi-table">
              <thead>
                <tr>
                  <th>Entité</th>
                  <th>Statut</th>
                  <th>Total</th>
                  <th>Réussis</th>
                  <th>Échecs</th>
                </tr>
              </thead>
              <tbody>
                {tracking.map((item) => (
                  <tr key={item.entity}>
                    <td style={{ fontWeight: 600 }}>{item.entity}</td>
                    <td>
                      <span className={`badge ${getStatusClass(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>{item.total || '-'}</td>
                    <td style={{ color: 'var(--success-color)', fontWeight: 600 }}>{item.successCount}</td>
                    <td style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{item.failureCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && <div className="badge status-2" style={{ marginTop: '16px', padding: '12px', display: 'block' }}>{message}</div>}
      {error && <div className="badge status-4" style={{ marginTop: '16px', padding: '12px', display: 'block', color: 'red' }}>{error}</div>}

      <div className="glpi-card" style={{ marginTop: '32px', background: '#fff' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Rappel technique</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          La purge utilise l'API Legacy pour récupérer les IDs et forcer la suppression définitive (purge) via le paramètre <code>force_purge=1</code>.
        </p>
      </div>
    </div>
  );
}
