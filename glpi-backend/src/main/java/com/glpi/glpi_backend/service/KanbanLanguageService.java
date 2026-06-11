package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.KanbanLanguage;
import com.glpi.glpi_backend.repository.KanbanLanguageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Service pour la gestion des labels multilingues du Kanban.
 *
 * Les 3 statuts gérés : 1 (Nouveau), 2 (En cours), 5 (Résolu)
 *
 * Contrairement à KanbanSetting (toujours INSERT),
 * ici on fait INSERT ou UPDATE selon si le label existe déjà.
 */
@Service
@RequiredArgsConstructor
public class KanbanLanguageService {

    private final KanbanLanguageRepository repository;

    private static final List<Integer> STATUS_IDS = List.of(1, 2, 5);

    // Labels par défaut français
    private static final Map<Integer, String> FR_DEFAULTS = new HashMap<>() {{
        put(1, "Nouveau");
        put(2, "En cours");
        put(5, "Résolu");
    }};

    /**
     * Retourne toutes les langues disponibles avec leurs labels.
     *
     * Retourne :
     * {
     *   "fr": { 1: "Nouveau", 2: "En cours", 5: "Résolu" },
     *   "mg": { 1: "Vaovao",  2: "Efa manao", 5: "Vita" }
     * }
     */
    public Map<String, Map<Integer, String>> getAll() {
        List<String> codes = repository.findDistinctLanguageCodes();

        // Toujours inclure le français même si pas en base
        if (!codes.contains("fr")) {
            codes = new ArrayList<>(codes);
            codes.add(0, "fr");
        }

        Map<String, Map<Integer, String>> result = new LinkedHashMap<>();
        for (String code : codes) {
            result.put(code, getByCode(code));
        }
        return result;
    }

    /**
     * Retourne les labels d'une langue.
     * Si langue inconnue → retourne les défauts français.
     */
    public Map<Integer, String> getByCode(String code) {
        List<KanbanLanguage> entries = repository.findByLanguageCode(code);

        Map<Integer, String> labels = new HashMap<>(FR_DEFAULTS);
        for (KanbanLanguage entry : entries) {
            labels.put(entry.getStatusId(), entry.getLabel());
        }
        return labels;
    }

    /**
     * Retourne les codes de langues disponibles.
     * Le français est toujours en premier.
     */
    public List<String> getAvailableCodes() {
        List<String> codes = new ArrayList<>(repository.findDistinctLanguageCodes());
        if (!codes.contains("fr")) codes.add(0, "fr");
        return codes;
    }

    /**
     * Sauvegarde ou met à jour les labels d'une langue.
     * INSERT si le label n'existe pas, UPDATE sinon.
     *
     * @param code   Code langue (ex: "mg")
     * @param labels Map { 1: "Vaovao", 2: "Efa manao", 5: "Vita" }
     */
    @Transactional
    public Map<Integer, String> saveLanguage(String code, Map<Integer, String> labels) {
        for (Integer statusId : STATUS_IDS) {
            String label = labels.getOrDefault(statusId, "");
            if (label.isBlank()) continue;

            KanbanLanguage entry = repository
                .findByLanguageCodeAndStatusId(code, statusId)
                .orElse(new KanbanLanguage(null, code, statusId, label));

            entry.setLabel(label);
            repository.save(entry);
        }
        return getByCode(code);
    }

    /**
     * Supprime une langue.
     * Le français ne peut pas être supprimé.
     */
    @Transactional
    public void deleteLanguage(String code) {
        if ("fr".equals(code)) {
            throw new IllegalArgumentException("Le français ne peut pas être supprimé.");
        }
        repository.deleteByLanguageCode(code);
    }
}