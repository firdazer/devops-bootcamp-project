data "aws_ami" "my_ami" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_network_interface" "node1_nic" {
  subnet_id       = module.my_vpc.public_subnets[0]
  security_groups = [module.my_sg.id]
  private_ips     = ["10.0.0.5"]
}

resource "aws_network_interface" "node2_nic" {
  subnet_id       = module.my_vpc.private_subnets[0]
  security_groups = [module.my_sg.id]
  private_ips     = ["10.0.0.135"]
}

resource "aws_network_interface" "node3_nic" {
  subnet_id       = module.my_vpc.private_subnets[0]
  security_groups = [module.my_sg.id]
  private_ips     = ["10.0.0.136"]
}

module "node1" {
  source                = "terraform-aws-modules/ec2-instance/aws"
  version               = "~> 6.0"
  name                  = "webserver"
  ami                   = data.aws_ami.my_ami.id
  instance_type         = "t3.micro"
  create_security_group = false
  key_name              = "Firdazer-keypair"
  network_interface = {
    0 = {
      network_interface_id        = aws_network_interface.node1_nic.id
      device_index                = 0
      associate_public_ip_address = true
    }
  }
  tags              = { Name = "webserver" }
  root_block_device = { size = 16 }
}

module "node2" {
  source                = "terraform-aws-modules/ec2-instance/aws"
  version               = "~> 6.0"
  name                  = "ansible-controller"
  ami                   = data.aws_ami.my_ami.id
  instance_type         = "t3.micro"
  create_security_group = false
  key_name              = "Firdazer-keypair"
  network_interface = {
    0 = {
      network_interface_id = aws_network_interface.node2_nic.id
      device_index         = 0
    }
  }
  tags              = { Name = "ansible-controller" }
  root_block_device = { size = 16 }
}

module "node3" {
  source                = "terraform-aws-modules/ec2-instance/aws"
  version               = "~> 6.0"
  name                  = "monitoring-server"
  ami                   = data.aws_ami.my_ami.id
  instance_type         = "t3.micro"
  create_security_group = false
  key_name              = "Firdazer-keypair"
  network_interface = {
    0 = {
      network_interface_id = aws_network_interface.node3_nic.id
      device_index         = 0
    }
  }
  tags              = { Name = "monitoring-server" }
  root_block_device = { size = 16 }
}