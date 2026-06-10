package com.glpi.glpi_backend.controller;


import com.glpi.glpi_backend.model.KanbanColorHistory;
import com.glpi.glpi_backend.service.KanbanColorHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints pour l'historique des couleurs.
 *
 * GET    /history/colors          → tout l'historique
 * GET    /history/colors/{id}     → historique d'un statut
 * DELETE /history/colors          → vider l'historique
 */
@RestController
@RequestMapping("/history")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class KanbanColorHistoryController {

    private final KanbanColorHistoryService service;

    @GetMapping("/colors")
    public ResponseEntity<List<KanbanColorHistory>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/colors/{statusId}")
    public ResponseEntity<List<KanbanColorHistory>> getByStatus(
        @PathVariable Integer statusId
    ) {
        return ResponseEntity.ok(service.getByStatusId(statusId));
    }

    @DeleteMapping("/colors")
    public ResponseEntity<Void> clearAll() {
        service.clearAll();
        return ResponseEntity.noContent().build();
    }
}
