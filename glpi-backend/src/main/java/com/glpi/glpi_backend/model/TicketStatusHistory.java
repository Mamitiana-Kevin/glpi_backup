package com.glpi.glpi_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Historique des changements de statut des tickets GLPI.
 * Enregistré à chaque drag & drop dans le Kanban.
 *
 * Exemple :
 *   ticketId=5, ticketName="Pb réseau",
 *   oldStatus=1 (Nouveau) → newStatus=2 (En cours)
 */
@Entity
@Table(name = "ticket_status_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ID du ticket dans GLPI
    @Column(nullable = false)
    private Integer ticketId;

    // Nom du ticket (pour lisibilité sans avoir à rappeler GLPI)
    @Column(nullable = false)
    private String ticketName;

    // Ancien statut (1=Nouveau, 2=En cours, 5=Résolu)
    @Column(nullable = false)
    private Integer oldStatus;

    // Nouveau statut
    @Column(nullable = false)
    private Integer newStatus;

    // Date du changement
    @Column(nullable = false)
    private LocalDateTime changedAt;

    @PrePersist
    public void prePersist() {
        this.changedAt = LocalDateTime.now();
    }
}
