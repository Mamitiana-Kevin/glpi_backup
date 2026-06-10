package com.glpi.glpi_backend.repository;


import com.glpi.glpi_backend.model.KanbanColorHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository pour l'historique des couleurs.
 *
 * EXEMPLES D'INTERACTIONS AVEC SQLITE :
 * ──────────────────────────────────────
 *
 * 1. Sauvegarder un changement de couleur :
 *    KanbanColorHistory h = new KanbanColorHistory();
 *    h.setStatusId(1);
 *    h.setOldColor("#3b82f6");
 *    h.setNewColor("#ef4444");
 *    h.setChangedBy("admin");
 *    repository.save(h);
 *    → INSERT INTO kanban_color_history (...) VALUES (...)
 *
 * 2. Récupérer l'historique d'un statut :
 *    repository.findByStatusIdOrderByChangedAtDesc(1)
 *    → SELECT * FROM kanban_color_history
 *      WHERE status_id = 1
 *      ORDER BY changed_at DESC
 *
 * 3. Supprimer tout l'historique :
 *    repository.deleteAll()
 *    → DELETE FROM kanban_color_history
 */
@Repository
public interface KanbanColorHistoryRepository extends JpaRepository<KanbanColorHistory, Long> {

    // Historique d'un statut spécifique, du plus récent au plus ancien
    List<KanbanColorHistory> findByStatusIdOrderByChangedAtDesc(Integer statusId);

    // Tout l'historique, du plus récent au plus ancien
    List<KanbanColorHistory> findAllByOrderByChangedAtDesc();
}
