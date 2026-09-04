SHELL := /bin/bash
.DEFAULT_GOAL := help

# Paths
TF_DIR      := terraform/aws
INVENTORY   := ansible/inventory.ini
SSH_KEY     := $(CURDIR)/$(TF_DIR)/Firdazer-keypair.pem
PLAYBOOK_DIR := ansible

# Ansible base flags
ANSIBLE_FLAGS := -i $(INVENTORY) --private-key $(SSH_KEY)

# Required env vars for full deploy
REQUIRED_VARS := AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# ──────────────────────────────────────────────
#  Help
# ──────────────────────────────────────────────
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
#  Environment checks
# ──────────────────────────────────────────────
.PHONY: check-env
check-env: ## Verify required env vars are set
	@echo "==> Checking required environment variables..."
	@for var in $(REQUIRED_VARS); do \
		if [ -z "$${!var}" ]; then \
			echo "ERROR: $$var is not set"; exit 1; \
		fi; \
	done
	@echo "    All required vars OK"

.PHONY: check-env-full
check-env-full: check-env ## Verify all env vars (including optional ones)
	@for var in GITHUB_REPO RUNNER_TOKEN CLOUDFLARE_TUNNEL_TOKEN CLOUDFLARE_MONITORING_TUNNEL_TOKEN; do \
		if [ -z "$${!var}" ]; then \
			echo "WARNING: $$var is not set (needed for deploy-runner / deploy-tunnels)"; \
		fi; \
	done

# ──────────────────────────────────────────────
#  Inventory management
# ──────────────────────────────────────────────
.PHONY: update-inventory
update-inventory: ## Regenerate inventory.ini with current EIP from Terraform
	@echo "==> Fetching node1 public IP from Terraform..."
	@cd $(TF_DIR) && EIP=$$(terraform output -raw node1_public_ip) && \
		echo "    node1 EIP: $$EIP" && \
		cd $(CURDIR) && \
	sed -e "s|@<EIP>|@$$EIP|g" \
		-e "s|node1 ansible_host=[0-9.]*|node1 ansible_host=$$EIP|" \
		$(INVENTORY).tmpl > $(INVENTORY)
	@echo "    Inventory updated: $(INVENTORY)"

# ──────────────────────────────────────────────
#  Terraform
# ──────────────────────────────────────────────
.PHONY: infra-init
infra-init: ## Initialize Terraform
	cd $(TF_DIR) && terraform init

.PHONY: infra-plan
infra-plan: ## Plan Terraform changes
	cd $(TF_DIR) && terraform plan

.PHONY: infra-apply
infra-apply: ## Apply Terraform infrastructure
	cd $(TF_DIR) && terraform apply -auto-approve

.PHONY: infra-destroy
infra-destroy: ## Destroy all Terraform infrastructure
	cd $(TF_DIR) && terraform destroy -auto-approve

.PHONY: infra-output
infra-output: ## Show Terraform outputs
	cd $(TF_DIR) && terraform output

# ──────────────────────────────────────────────
#  Ansible deployments
# ──────────────────────────────────────────────
.PHONY: install-galaxy
install-galaxy: ## Install required Ansible Galaxy roles/collections
	ansible-galaxy install -r $(PLAYBOOK_DIR)/requirements.yml --force
	ansible-galaxy collection install community.docker --force

.PHONY: deploy-base
deploy-base: check-env ## Bootstrap Nginx, Docker, node_exporter on all nodes
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/first-playbook.yml

.PHONY: deploy-app
deploy-app: check-env ## Pull app from ECR and deploy on node1
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/docker-install.yml

.PHONY: deploy-monitoring
deploy-monitoring: ## Deploy Prometheus + Grafana on node3
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/monitoring.yml

.PHONY: deploy-runner
deploy-runner: ## Deploy self-hosted GitHub Actions runner on node2
	@for var in GITHUB_REPO RUNNER_TOKEN; do \
		if [ -z "$${!var}" ]; then \
			echo "ERROR: $$var is not set"; exit 1; \
		fi; \
	done
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/github-runner.yml

.PHONY: deploy-tunnels
deploy-tunnels: ## Deploy Cloudflare tunnels on node1 + node3
	@for var in CLOUDFLARE_TUNNEL_TOKEN CLOUDFLARE_MONITORING_TUNNEL_TOKEN; do \
		if [ -z "$${!var}" ]; then \
			echo "ERROR: $$var is not set"; exit 1; \
		fi; \
	done
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/cloudflare-tunnel.yml
	cd $(CURDIR) && ansible-playbook $(ANSIBLE_FLAGS) $(PLAYBOOK_DIR)/cloudflare-tunnel-monitoring.yml

# ──────────────────────────────────────────────
#  Combined workflows
# ──────────────────────────────────────────────
.PHONY: deploy-all
deploy-all: update-inventory deploy-base ## Full deployment (base + app + monitoring + runner + tunnels)
	@echo "==> Waiting 30s for services to stabilize..."
	@sleep 30
	$(MAKE) deploy-app
	@echo "==> Waiting 15s..."
	@sleep 15
	$(MAKE) deploy-monitoring
	@echo "==> Waiting 15s..."
	@sleep 15
	$(MAKE) deploy-runner
	$(MAKE) deploy-tunnels
	@echo "==> All deployments complete!"

.PHONY: rebuild
rebuild: infra-destroy infra-apply update-inventory install-galaxy deploy-all ## Full rebuild: destroy → apply → deploy everything
	@echo "==> Rebuild complete!"

.PHONY: destroy
destroy: infra-destroy ## Destroy infrastructure only
