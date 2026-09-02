variable "az" {
  description = "Availability Zone untuk semua subnet"
  type        = string
  default     = "ap-southeast-1a"
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "devops-bootcamp-project/app"
}