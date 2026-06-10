package com.glpi.glpi_backend.repository;


import com.glpi.glpi_backend.model.KanbanSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository pour KanbanSetting.
 *
 * COMMENT INTERAGIR AVEC SQLITE DEPUIS SPRING :
 * ─────────────────────────────────────────────
 * Spring Data JPA génère automatiquement les requêtes SQL
 * à partir des noms de méthodes. Exemples :
 *
 *   findAll()
 *     → SELECT * FROM kanban_settings
 *
 *   findByKey("color_1")
 *     → SELECT * FROM kanban_settings WHERE key = 'color_1'
 *
 *   save(entity)
 *     → INSERT INTO kanban_settings (...) VALUES (...)
 *       (si id est null = INSERT, sinon UPDATE)
 *
 *   deleteById(1L)
 *     → DELETE FROM kanban_settings WHERE id = 1
 *
 * Pour des requêtes personnalisées, utiliser @Query avec JPQL :
 *
 *   @Query("SELECT s FROM KanbanSetting s WHERE s.key = :key
 *           ORDER BY s.createdAt DESC")
 *   List<KanbanSetting> findByKeyOrderByDate(@Param("key") String key);
 */
@Repository
public interface KanbanSettingRepository extends JpaRepository<KanbanSetting, Long> {

    /**
     * Récupère la valeur la plus récente pour une clé donnée.
     * On prend toujours le dernier INSERT, jamais d'UPDATE.
     *
     * SQL généré :
     * SELECT * FROM kanban_settings
     * WHERE key = ?
     * ORDER BY created_at DESC
     * LIMIT 1
     */
    @Query("SELECT s FROM KanbanSetting s WHERE s.key = :key ORDER BY s.createdAt DESC")
    Optional<KanbanSetting> findLatestByKey(String key);
}
