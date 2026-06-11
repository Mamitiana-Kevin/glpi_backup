package com.glpi.glpi_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Représente un label de colonne Kanban pour une langue donnée.
 *
 * Exemple de données :
 *   languageCode="fr", statusId=1, label="Nouveau"
 *   languageCode="mg", statusId=1, label="Vaovao"
 *   languageCode="en", statusId=1, label="New"
 *
 * Contrairement à KanbanSetting, on fait des UPDATE ici
 * car c'est une table de référence stable.
 */
@Entity
@Table(
  name = "kanban_languages",
  uniqueConstraints = @UniqueConstraint(columnNames = {"language_code", "status_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanLanguage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Code de la langue (ex: "fr", "mg", "en")
    @Column(name = "language_code", nullable = false)
    private String languageCode;

    // ID du statut GLPI (1=Nouveau, 2=En cours, 5=Résolu)
    @Column(name = "status_id", nullable = false)
    private Integer statusId;

    // Label traduit
    @Column(nullable = false)
    private String label;
}