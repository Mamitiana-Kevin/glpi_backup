package com.glpi.glpi_backend.repository;

import com.glpi.glpi_backend.model.KanbanLanguage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository pour les labels multilingues du Kanban.
 *
 * EXEMPLES D'INTERACTIONS SQLITE :
 * ─────────────────────────────────
 *
 * Récupérer tous les labels français :
 *   findByLanguageCode("fr")
 *   → SELECT * FROM kanban_languages WHERE language_code = 'fr'
 *
 * Récupérer un label précis :
 *   findByLanguageCodeAndStatusId("mg", 1)
 *   → SELECT * FROM kanban_languages
 *     WHERE language_code = 'mg' AND status_id = 1
 *
 * Lister les codes disponibles :
 *   findDistinctLanguageCodes()
 *   → SELECT DISTINCT language_code FROM kanban_languages
 *
 * Supprimer une langue :
 *   deleteByLanguageCode("en")
 *   → DELETE FROM kanban_languages WHERE language_code = 'en'
 */
@Repository
public interface KanbanLanguageRepository extends JpaRepository<KanbanLanguage, Long> {

    List<KanbanLanguage> findByLanguageCode(String languageCode);

    Optional<KanbanLanguage> findByLanguageCodeAndStatusId(
        String languageCode,
        Integer statusId
    );

    @Query("SELECT DISTINCT k.languageCode FROM KanbanLanguage k")
    List<String> findDistinctLanguageCodes();

    void deleteByLanguageCode(String languageCode);
}