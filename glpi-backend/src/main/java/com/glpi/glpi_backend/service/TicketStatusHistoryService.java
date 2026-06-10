package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.TicketStatusHistory;
import com.glpi.glpi_backend.repository.TicketStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketStatusHistoryService {

    private final TicketStatusHistoryRepository repository;

    /**
     * Enregistre un changement de statut de ticket.
     *
     * @param ticketId   ID du ticket dans GLPI
     * @param ticketName Nom du ticket
     * @param oldStatus  Ancien statut (1, 2 ou 5)
     * @param newStatus  Nouveau statut (1, 2 ou 5)
     */
    public TicketStatusHistory save(
        Integer ticketId,
        String ticketName,
        Integer oldStatus,
        Integer newStatus
    ) {
        TicketStatusHistory history = new TicketStatusHistory();
        history.setTicketId(ticketId);
        history.setTicketName(ticketName);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        return repository.save(history);
    }

    public List<TicketStatusHistory> getAll() {
        return repository.findAllByOrderByChangedAtDesc();
    }

    public List<TicketStatusHistory> getByTicketId(Integer ticketId) {
        return repository.findByTicketIdOrderByChangedAtDesc(ticketId);
    }

    public void clearAll() {
        repository.deleteAll();
    }
}
