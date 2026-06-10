package com.glpi.glpi_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Historique des changements de couleur du Kanban.
 * Enregistre l'ancienne et la nouvelle couleur à chaque modification.
 *
 * Exemple :
 *   statusId=1, oldColor="#3b82f6", newColor="#ef4444"
 *   → La colonne "Nouveau" est passée du bleu au rouge
 */
@Entity
@Table(name = "kanban_color_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanColorHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ID du statut concerné (1=Nouveau, 2=En cours, 5=Résolu)
    @Column(nullable = false)
    private Integer statusId;

    // Ancienne couleur hexadécimale
    @Column(nullable = false)
    private String oldColor;

    // Nouvelle couleur hexadécimale
    @Column(nullable = false)
    private String newColor;

    // Date du changement
    @Column(nullable = false)
    private LocalDateTime changedAt;

    // Qui a fait le changement
    @Column(nullable = false)
    private String changedBy;

    @PrePersist
    public void prePersist() {
        this.changedAt = LocalDateTime.now();
    }
}
