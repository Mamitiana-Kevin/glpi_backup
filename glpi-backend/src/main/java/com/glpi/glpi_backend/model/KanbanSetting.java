package com.glpi.glpi_backend.model;


import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Représente un paramètre de configuration du Kanban.
 *
 * IMPORTANT : On ne fait jamais d'UPDATE sur cette table.
 * Chaque modification crée un nouvel enregistrement (INSERT).
 * Pour lire la valeur actuelle d'une clé, on prend toujours
 * l'enregistrement le plus récent (ORDER BY createdAt DESC LIMIT 1).
 *
 * Clés utilisées :
 *   - color_1 → couleur de la colonne "Nouveau"
 *   - color_2 → couleur de la colonne "En cours"
 *   - color_5 → couleur de la colonne "Résolu"
 *   - label_1 → label de la colonne "Nouveau"
 *   - label_2 → label de la colonne "En cours"
 *   - label_5 → label de la colonne "Résolu"
 */
@Entity
@Table(name = "kanban_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Clé du paramètre (ex: "color_1", "label_1")
    @Column(name = "key", nullable = false)
    private String settingKey;

    // Valeur du paramètre (ex: "#3b82f6", "Vaovao")
    @Column(nullable = false)
    private String value;

    // Date de création de cet enregistrement
    @Column(nullable = false)
    private LocalDateTime createdAt;

    // Qui a fait le changement
    @Column(nullable = false)
    private String changedBy;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
