package com.glpi.glpi_backend.service;

import com.glpi.glpi_backend.model.KanbanColorHistory;
import com.glpi.glpi_backend.repository.KanbanColorHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class KanbanColorHistoryService {

    private final KanbanColorHistoryRepository repository;

    public List<KanbanColorHistory> getAll() {
        return repository.findAllByOrderByChangedAtDesc();
    }

    public List<KanbanColorHistory> getByStatusId(Integer statusId) {
        return repository.findByStatusIdOrderByChangedAtDesc(statusId);
    }

    public void clearAll() {
        repository.deleteAll();
    }
}
