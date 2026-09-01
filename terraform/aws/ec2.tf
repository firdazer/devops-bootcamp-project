data "aws_ami" "my_ami" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

module "node1" {
  source                 = "terraform-aws-modules/ec2-instance/aws"
  version                = "~> 6.0"
  name                   = "webserver"
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.my_vpc.public_subnets[0]
  private_ip             = "10.0.0.5"
  create_security_group  = false
  vpc_security_group_ids = [module.public_sg.id]
  key_name               = "Firdazer-keypair"
  tags                   = { Name = "webserver" }
  root_block_device      = { size = 16 }
}

resource "aws_eip" "node1_eip" {
  domain = "vpc"

  tags = {
    Name = "node1-public-ip"
  }
}

resource "aws_eip_association" "node1_eip_assoc" {
  instance_id   = module.node1.id
  allocation_id = aws_eip.node1_eip.id
}

module "node2" {
  source                 = "terraform-aws-modules/ec2-instance/aws"
  version                = "~> 6.0"
  name                   = "ansible-controller"
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.my_vpc.private_subnets[0]
  private_ip             = "10.0.1.135"
  create_security_group  = false
  vpc_security_group_ids = [module.private_sg.id]
  key_name               = "Firdazer-keypair"
  tags                   = { Name = "ansible-controller" }
  root_block_device      = { size = 16 }
}


module "node3" {
  source                 = "terraform-aws-modules/ec2-instance/aws"
  version                = "~> 6.0"
  name                   = "monitoring-server"
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.my_vpc.private_subnets[0]
  private_ip             = "10.0.1.136"
  create_security_group  = false
  vpc_security_group_ids = [module.private_sg.id]
  key_name               = "Firdazer-keypair"
  tags                   = { Name = "monitoring-server" }
  root_block_device      = { size = 16 }
}
