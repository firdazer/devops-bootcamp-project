module "my_vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.0"

  name = "tf-vpc"
  cidr = "10.0.0.0/16"
  azs  = [var.az]

  public_subnets  = ["10.0.0.0/24"]
  private_subnets = ["10.0.1.0/24"]

  map_public_ip_on_launch      = true
  create_igw                   = false
  enable_nat_gateway           = false
  create_database_subnet_group = false
}

resource "aws_internet_gateway" "devops_igw" {
  vpc_id = module.my_vpc.vpc_id

  tags = {
    Name = "devops-igw"
  }
}

resource "aws_nat_gateway" "devops_ngw" {
  allocation_id = aws_eip.devops_nat.id
  subnet_id     = module.my_vpc.public_subnets[0]

  tags = {
    Name = "devops-ngw"
  }

  depends_on = [aws_internet_gateway.devops_igw]
}

resource "aws_eip" "devops_nat" {
  domain = "vpc"

  tags = {
    Name = "devops-ngw-eip"
  }
}

resource "aws_route" "devops_public_igw" {
  route_table_id         = module.my_vpc.public_route_table_ids[0]
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.devops_igw.id
}

resource "aws_route" "devops_private_nat" {
  route_table_id         = module.my_vpc.private_route_table_ids[0]
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.devops_ngw.id
}
