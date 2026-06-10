package com.glpi.glpi_backend.controller;


import com.glpi.glpi_backend.service.KanbanSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoints pour les paramètres du Kanban.
 *
 * GET  /settings/kanban
 *   → Retourne les paramètres actuels (couleurs + labels)
 *   → Exemple réponse :
 *     {
 *       "color_1": "#3b82f6",
 *       "color_2": "#f59e0b",
 *       "color_5": "#16a34a",
 *       "label_1": "Vaovao",
 *       "label_2": "Efa manao",
 *       "label_5": "Vita"
 *     }
 *
 * POST /settings/kanban
 *   → Sauvegarde de nouveaux paramètres (toujours INSERT)
 *   → Body exemple :
 *     {
 *       "settings": { "color_1": "#ef4444", "label_1": "Vaovao" },
 *       "changedBy": "admin"
 *     }
 */
@RestController
@RequestMapping("/settings")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class KanbanSettingsController {

    private final KanbanSettingService service;

    @GetMapping("/kanban")
    public ResponseEntity<Map<String, String>> getSettings() {
        return ResponseEntity.ok(service.getCurrentSettings());
    }

    @PostMapping("/kanban")
    public ResponseEntity<Map<String, String>> saveSettings(
        @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        Map<String, String> settings = (Map<String, String>) body.get("settings");
        String changedBy = (String) body.getOrDefault("changedBy", "admin");
        return ResponseEntity.ok(service.saveSettings(settings, changedBy));
    }
}
