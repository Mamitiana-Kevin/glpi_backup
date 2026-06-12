package com.glpi.glpi_backend.controller;


import com.glpi.glpi_backend.service.KanbanLanguageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

/**
 * Endpoints pour les labels multilingues du Kanban.
 *
 * GET    /settings/languages
 *   → Toutes les langues
 *   → { "fr": {1:"Nouveau",...}, "mg": {1:"Vaovao",...} }
 *
 * GET    /settings/languages/codes
 *   → ["fr", "mg", "en"]
 *
 * GET    /settings/languages/{code}
 *   → Labels d'une langue : { 1: "Vaovao", 2: "Efa manao", 5: "Vita" }
 *
 * POST   /settings/languages
 *   → Body: { "code": "mg", "labels": { "1": "Vaovao", "2": "Efa manao", "5": "Vita" } }
 *
 * DELETE /settings/languages/{code}
 *   → Supprimer une langue (sauf fr)
 */
@RestController
@RequestMapping("/settings/languages")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class KanbanLanguageController {

    private final KanbanLanguageService service;

    @GetMapping
    public ResponseEntity<Map<String, Map<Integer, String>>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/codes")
    public ResponseEntity<List<String>> getCodes() {
        return ResponseEntity.ok(service.getAvailableCodes());
    }

    @GetMapping("/{code}")
    public ResponseEntity<Map<Integer, String>> getByCode(@PathVariable String code) {
        return ResponseEntity.ok(service.getByCode(code));
    }

    @PostMapping
    public ResponseEntity<Map<Integer, String>> save(
        @RequestBody Map<String, Object> body
    ) {
        String code = (String) body.get("code");

        @SuppressWarnings("unchecked")
        Map<Object, String> rawLabels = (Map<Object, String>) body.get("labels");

        // Convertir les clés en Integer
        Map<Integer, String> labels = new java.util.HashMap<>();
        rawLabels.forEach((k, v) -> {
            Integer statusId;
            if (k instanceof Integer) {
                statusId = (Integer) k;
            } else {
                statusId = Integer.parseInt(k.toString());
            }
            labels.put(statusId, v);
        });

        return ResponseEntity.ok(service.saveLanguage(code, labels));
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<Void> delete(@PathVariable String code) {
        try {
            service.deleteLanguage(code);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}