import { useMemo, useState } from 'react'
import { allAPI, purgeAll, purgeSqliteDb } from '../../services/resetService'

export default function Reset() {
  const [selected, setSelected] = useState(() => allAPI.map((entity) => entity.url))
  const [isResetting, setIsResetting] = useState(false)
  const [isPurgingSqlite, setIsPurgingSqlite] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tracking, setTracking] = useState([])
  const [completedCount, setCompletedCount] = useState(0)

  const selectedCount = selected.length
  const totalCount = allAPI.length
  const isAllSelected = selectedCount === totalCount
  const trackingTotal = tracking.length

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

  const handlePurgeSqlite = async () => {
    try {
      setIsPurgingSqlite(true)
      setError('')
      setMessage('')
      const result = await purgeSqliteDb()
      setMessage(`SQLite : ${result.message}`)
    } catch {
      setError('Impossible de supprimer la base de données SQLite.')
    } finally {
      setIsPurgingSqlite(false)
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#16a34a'
      case 'warning': return '#d97706'
      case 'error': return '#dc2626'
      case 'running': return '#2563eb'
      default: return '#6b7280'
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

      {/* Titre */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Reset des données</h1>
        <p style={{ color: '#6b7280', marginBottom: 4 }}>
          Coche les entités à purger, puis lance le reset uniquement sur celles sélectionnées.
        </p>
        <small style={{ color: '#9ca3af' }}>{selectedLabel}</small>
      </div>

      {/* Grille des checkboxes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 24
      }}>
        {allAPI.map((entity) => (
          <label
            key={entity.url}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              border: selected.includes(entity.url) ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
              borderRadius: 8,
              cursor: 'pointer',
              background: selected.includes(entity.url) ? '#eff6ff' : '#fff',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(entity.url)}
              onChange={() => toggleEntity(entity.url)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{entity.url}</span>
          </label>
        ))}
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={toggleAll}
          disabled={isResetting || isPurgingSqlite}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#f9fafb',
            cursor: isResetting || isPurgingSqlite ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          {isAllSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>

        <button
          onClick={handleReset}
          disabled={isResetting || isPurgingSqlite || selected.length === 0}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: isResetting || isPurgingSqlite || selected.length === 0 ? '#fca5a5' : '#dc2626',
            color: '#fff',
            cursor: isResetting || isPurgingSqlite || selected.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {isResetting ? 'Purge en cours...' : 'Lancer le reset'}
        </button>

        <button
          onClick={handlePurgeSqlite}
          disabled={isResetting || isPurgingSqlite}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: isResetting || isPurgingSqlite ? '#fca5a5' : '#dc2626',
            color: '#fff',
            cursor: isResetting || isPurgingSqlite ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            marginLeft: 'auto',
          }}
        >
          {isPurgingSqlite ? 'Suppression SQLite en cours...' : 'Supprimer la BD SQLite'}
        </button>
      </div>

      {/* Suivi */}
      {tracking.length > 0 && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#f9fafb',
          padding: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontWeight: 500, color: '#111827' }}>Détail du suivi</p>
            <small style={{ color: '#6b7280' }}>{completedCount} / {trackingTotal} étape(s) terminée(s)</small>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tracking.map((item) => (
              <div
                key={item.entity}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{item.entity}</p>
                  <small style={{ color: '#6b7280', fontSize: 12 }}>
                    {item.total > 0
                      ? `${item.successCount} OK · ${item.failureCount} erreur(s) · ${item.total} total`
                      : 'En attente de traitement'}
                  </small>
                </div>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#fff',
                  background: getStatusColor(item.status),
                }}>
                  {getStatusLabel(item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#16a34a',
          marginBottom: 12,
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* Rappel */}
      <div style={{
        marginTop: 32,
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Rappel</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          La purge utilise <code>getIdsPour</code> pour récupérer les IDs de chaque entité cochée,
          puis appelle la suppression définitive sur chaque élément.
        </p>
      </div>

    </div>
  )
}