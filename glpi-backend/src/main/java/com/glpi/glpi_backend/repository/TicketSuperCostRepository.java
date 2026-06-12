package com.glpi.glpi_backend.repository;

import com.glpi.glpi_backend.model.TicketSuperCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TicketSuperCostRepository extends JpaRepository<TicketSuperCost, Long> {

    Optional<TicketSuperCost> findByTicketId(Integer ticketId);

}
