package com.glpi.glpi_backend.repository;

import com.glpi.glpi_backend.model.TicketStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository pour l'historique des changements de statut des tickets.
 *
 * EXEMPLES D'INTERACTIONS AVEC SQLITE :
 * ──────────────────────────────────────
 *
 * 1. Enregistrer un changement de statut :
 *    TicketStatusHistory h = new TicketStatusHistory();
 *    h.setTicketId(5);
 *    h.setTicketName("Problème réseau");
 *    h.setOldStatus(1);
 *    h.setNewStatus(2);
 *    repository.save(h);
 *
 * 2. Historique d'un ticket précis :
 *    repository.findByTicketIdOrderByChangedAtDesc(5)
 *    → SELECT * FROM ticket_status_history
 *      WHERE ticket_id = 5
 *      ORDER BY changed_at DESC
 *
 * 3. Tout l'historique :
 *    repository.findAllByOrderByChangedAtDesc()
 *    → SELECT * FROM ticket_status_history
 *      ORDER BY changed_at DESC
 */
@Repository
public interface TicketStatusHistoryRepository extends JpaRepository<TicketStatusHistory, Long> {

    List<TicketStatusHistory> findByTicketIdOrderByChangedAtDesc(Integer ticketId);
    List<TicketStatusHistory> findAllByOrderByChangedAtDesc();
}
