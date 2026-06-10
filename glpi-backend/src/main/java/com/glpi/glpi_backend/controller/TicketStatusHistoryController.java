package com.glpi.glpi_backend.controller;

import com.glpi.glpi_backend.model.TicketStatusHistory;
import com.glpi.glpi_backend.service.TicketStatusHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints pour l'historique des statuts de tickets.
 *
 * POST   /history/ticket-status
 *   → Enregistre un changement de statut
 *   → Body :
 *     {
 *       "ticketId": 5,
 *       "ticketName": "Problème réseau",
 *       "oldStatus": 1,
 *       "newStatus": 2
 *     }
 *
 * GET    /history/ticket-status          → tout l'historique
 * GET    /history/ticket-status/{id}     → historique d'un ticket
 * DELETE /history/ticket-status          → vider l'historique
 */
@RestController
@RequestMapping("/history")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class TicketStatusHistoryController {

    private final TicketStatusHistoryService service;

    @PostMapping("/ticket-status")
    public ResponseEntity<TicketStatusHistory> save(
        @RequestBody Map<String, Object> body
    ) {
        Integer ticketId   = (Integer) body.get("ticketId");
        String ticketName  = (String)  body.get("ticketName");
        Integer oldStatus  = (Integer) body.get("oldStatus");
        Integer newStatus  = (Integer) body.get("newStatus");

        return ResponseEntity.ok(
            service.save(ticketId, ticketName, oldStatus, newStatus)
        );
    }

    @GetMapping("/ticket-status")
    public ResponseEntity<List<TicketStatusHistory>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/ticket-status/{ticketId}")
    public ResponseEntity<List<TicketStatusHistory>> getByTicket(
        @PathVariable Integer ticketId
    ) {
        return ResponseEntity.ok(service.getByTicketId(ticketId));
    }

    @DeleteMapping("/ticket-status")
    public ResponseEntity<Void> clearAll() {
        service.clearAll();
        return ResponseEntity.noContent().build();
    }
}
